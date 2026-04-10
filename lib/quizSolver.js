import {
  startQuizAttempt,
  getAllQuestions,
  parseQuestion,
  submitAnswer,
  submitQuizAttempt,
  getAttemptResult,
} from "@/lib/moodleQuizAttempt";
import { solveQuestion, isGeminiConfigurationError } from "@/lib/aiQuestionSolver";
import { getMoodleConfig } from "@/lib/config";

export async function solveQuizAttempt({ quizId, submitMode = "submit" }) {
  if (!quizId) {
    return { success: false, error: "quizId required", statusCode: 400 };
  }

  const { moodleUrl, token } = getMoodleConfig();
  const geminiKey = process.env.GEMINI_API_KEY;
  const shouldSubmit = submitMode !== "save";

  const log = [];
  const addLog = (step, message, data = null) => {
    console.log(`[${step}] ${message}`, data || "");
    log.push({ step, message, ts: Date.now() });
  };

  if (!geminiKey?.trim()) {
    const message = "Gemini API key is missing. Set GEMINI_API_KEY in your environment and restart the server.";
    addLog("error", message);
    return {
      success: false,
      error: message,
      code: "GEMINI_API_KEY_MISSING",
      log,
      statusCode: 503,
    };
  }

  try {
    addLog("start", `Starting attempt for quiz ${quizId}...`);
    const attempt = await startQuizAttempt(moodleUrl, token, quizId);
    const attemptId = attempt.id;
    addLog("start", `Attempt created: ID=${attemptId} state=${attempt.state}`);

    addLog("fetch", "Fetching all pages of questions...");
    const rawQuestions = await getAllQuestions(moodleUrl, token, attemptId);
    addLog("fetch", `Got ${rawQuestions.length} raw questions`);

    rawQuestions.forEach((rq, idx) => {
      addLog("raw_question", `Raw Q${rq.slot || idx + 1} (type: ${rq.type}):`, {
        slot: rq.slot,
        type: rq.type,
        status: rq.status,
        hasHtml: !!rq.html,
        htmlSnippet: rq.html ? rq.html : "EMPTY",
      });
    });

    const questions = rawQuestions.map(parseQuestion);

    questions.forEach((pq) => {
      addLog("parsed_data", `Parsed Q${pq.slot}:`, {
        text: pq.question_text.slice(0, 100),
        optionsCount: pq.choices?.length || 0,
        options: pq.choices,
      });
    });

    const solvable = questions.filter((q) => q.choices && q.choices.length > 0);
    addLog("fetch", `${solvable.length} solvable (have choices), ${questions.length - solvable.length} skipped`);

    const results = [];

    for (const question of questions) {
      if (!question.choices || question.choices.length === 0) {
        results.push({ slot: question.slot, skipped: true, type: question.type });
        continue;
      }

      addLog("question_step", `[SLOT ${question.slot}] Getting question with options...`);
      addLog(
        "moodle_detail",
        `Q: "${question.question_text.substring(0, 100)}..." Options: [${question.choices.join(" | ")}]`
      );

      addLog("question_step", `[SLOT ${question.slot}] Sending to Gemini AI for solving...`);

      let answer;
      try {
        answer = await solveQuestion(question.question_text, question.choices, geminiKey);
      } catch (aiError) {
        if (isGeminiConfigurationError(aiError)) {
          addLog("error", `[SLOT ${question.slot}] AI configuration failed — ${aiError.message}`);
          return {
            success: false,
            error: aiError.message,
            code: aiError.code || "GEMINI_CONFIGURATION_ERROR",
            results,
            log,
            statusCode: 503,
          };
        }

        addLog("error", `[SLOT ${question.slot}] AI failed — ${aiError.message}`);
        results.push({ slot: question.slot, success: false, error: aiError.message });
        continue;
      }

      addLog(
        "ai_result",
        `[SLOT ${question.slot}] AI Choose ID: ${answer.correct_answer_number} | Name: "${answer.correct_answer_text}"`
      );
      addLog("ai_reason", `[SLOT ${question.slot}] Reason: ${answer.reasoning} (Confidence: ${answer.confidence})`);

      try {
        await submitAnswer(moodleUrl, token, attemptId, question, answer.correct_answer_number);
        addLog("submit_status", `[SLOT ${question.slot}] Answer submitted SUCCESS to Moodle.`);
      } catch (submitError) {
        addLog("submit_status", `[SLOT ${question.slot}] Answer submission FAILED: ${submitError.message}`);
        results.push({ slot: question.slot, success: false, error: submitError.message });
        continue;
      }

      results.push({
        slot: question.slot,
        question: question.question_text,
        options: question.choices,
        answer: answer.correct_answer_text,
        reasoning: answer.reasoning,
        confidence: answer.confidence,
        success: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (shouldSubmit) {
      addLog("finish", "Submitting quiz attempt...");
      await submitQuizAttempt(moodleUrl, token, attemptId);
      addLog("finish", "Quiz submitted!");
    } else {
      addLog("finish", "Answers saved only. Quiz attempt left open for manual submission.");
    }

    let review = null;
    if (shouldSubmit) {
      try {
        review = await getAttemptResult(moodleUrl, token, attemptId);
        addLog("result", `Score: ${review?.grade ?? "N/A"}`);
      } catch {
        addLog("result", "Review not yet available");
      }
    }

    return {
      success: true,
      attemptId,
      submitted: shouldSubmit,
      totalQuestions: questions.length,
      answered: results.filter((result) => result.success).length,
      results,
      review,
      log,
      statusCode: 200,
    };
  } catch (error) {
    console.error("AI Solve Error Catch:", error.message);
    return { success: false, error: error.message, log, statusCode: 500 };
  }
}