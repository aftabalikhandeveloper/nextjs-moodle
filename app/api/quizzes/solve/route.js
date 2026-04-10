// app/api/quizzes/solve/route.js
import { NextResponse } from "next/server";
import {
  startQuizAttempt,
  getAllQuestions,
  parseQuestion,
  submitAnswer,
  submitQuizAttempt,
  getAttemptResult,
} from "@/lib/moodleQuizAttempt";
import { solveQuestion, isGeminiConfigurationError } from "@/lib/aiQuestionSolver";

const MOODLE_URL  = process.env.MOODLE_URL;
const MOODLE_TOKEN = process.env.MOODLE_TOKEN;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;

export async function POST(request) {
  const { quizId, submitMode = "submit" } = await request.json();
  if (!quizId) return NextResponse.json({ error: "quizId required" }, { status: 400 });

  const shouldSubmit = submitMode !== "save";

  const log = [];
  const addLog = (step, message, data = null) => {
    console.log(`[${step}] ${message}`, data || "");
    log.push({ step, message, ts: Date.now() });
  };

  if (!GEMINI_KEY?.trim()) {
    const message = "Gemini API key is missing. Set GEMINI_API_KEY in your environment and restart the server.";
    addLog("error", message);
    return NextResponse.json(
      { success: false, error: message, code: "GEMINI_API_KEY_MISSING", log },
      { status: 503 }
    );
  }

  try {
    // 1. Start attempt
    addLog("start", `Starting attempt for quiz ${quizId}...`);
    const attempt = await startQuizAttempt(MOODLE_URL, MOODLE_TOKEN, quizId);
    const attemptId = attempt.id;
    addLog("start", `Attempt created: ID=${attemptId} state=${attempt.state}`);

    // 2. Fetch all questions
    addLog("fetch", "Fetching all pages of questions...");
    const rawQuestions = await getAllQuestions(MOODLE_URL, MOODLE_TOKEN, attemptId);
    addLog("fetch", `Got ${rawQuestions.length} raw questions`);

    // LOG RAW QUESTIONS FOR TRACKING
    rawQuestions.forEach((rq, idx) => {
      addLog("raw_question", `Raw Q${rq.slot || idx + 1} (type: ${rq.type}):`, {
        slot: rq.slot,
        type: rq.type,
        status: rq.status,
        hasHtml: !!rq.html,
        htmlSnippet: rq.html ? rq.html : "EMPTY"
      });
    });

    const questions = rawQuestions.map(parseQuestion);
    
    // LOG PARSED QUESTIONS DATA
    questions.forEach((pq) => {
      addLog("parsed_data", `Parsed Q${pq.slot}:`, {
        text: pq.question_text.slice(0, 100),
        optionsCount: pq.choices?.length || 0,
        options: pq.choices
      });
    });

    const solvable  = questions.filter(q => q.choices && q.choices.length > 0);
    addLog("fetch", `${solvable.length} solvable (have choices), ${questions.length - solvable.length} skipped`);

    // 3. Solve + submit each question
    const results = [];

    for (const q of questions) {
      if (!q.choices || q.choices.length === 0) {
        results.push({ slot: q.slot, skipped: true, type: q.type });
        continue;
      }

      addLog("question_step", `[SLOT ${q.slot}] Getting question with options...`);
      addLog("moodle_detail", `Q: "${q.question_text.substring(0, 100)}..." Options: [${q.choices.join(" | ")}]`);

      addLog("question_step", `[SLOT ${q.slot}] Sending to Gemini AI for solving...`);
      
      let answer;
      try {
        answer = await solveQuestion(q.question_text, q.choices, GEMINI_KEY);
      } catch (aiErr) {
        if (isGeminiConfigurationError(aiErr)) {
          addLog("error", `[SLOT ${q.slot}] AI configuration failed — ${aiErr.message}`);
          return NextResponse.json(
            {
              success: false,
              error: aiErr.message,
              code: aiErr.code || "GEMINI_CONFIGURATION_ERROR",
              results,
              log,
            },
            { status: 503 }
          );
        }

        addLog("error", `[SLOT ${q.slot}] AI failed — ${aiErr.message}`);
        results.push({ slot: q.slot, success: false, error: aiErr.message });
        continue;
      }

      addLog("ai_result", `[SLOT ${q.slot}] AI Choose ID: ${answer.correct_answer_number} | Name: "${answer.correct_answer_text}"`);
      addLog("ai_reason", `[SLOT ${q.slot}] Reason: ${answer.reasoning} (Confidence: ${answer.confidence})`);

      // Submit answer
      try {
        await submitAnswer(MOODLE_URL, MOODLE_TOKEN, attemptId, q, answer.correct_answer_number);
        addLog("submit_status", `[SLOT ${q.slot}] Answer submitted SUCCESS to Moodle.`);
      } catch (submitErr) {
        addLog("submit_status", `[SLOT ${q.slot}] Answer submission FAILED: ${submitErr.message}`);
        results.push({ slot: q.slot, success: false, error: submitErr.message });
        continue;
      }

      results.push({
        slot:          q.slot,
        question:      q.question_text,
        options:       q.choices,
        answer:        answer.correct_answer_text,
        reasoning:     answer.reasoning,
        confidence:    answer.confidence,
        success:       true,
      });

      // Small delay between questions
      await new Promise(r => setTimeout(r, 300));
    }

    // 4. Optionally submit quiz
    if (shouldSubmit) {
      addLog("finish", "Submitting quiz attempt...");
      await submitQuizAttempt(MOODLE_URL, MOODLE_TOKEN, attemptId);
      addLog("finish", "Quiz submitted!");
    } else {
      addLog("finish", "Answers saved only. Quiz attempt left open for manual submission.");
    }

    // 5. Try to get result only after final submit
    let review = null;
    if (shouldSubmit) {
      try {
        review = await getAttemptResult(MOODLE_URL, MOODLE_TOKEN, attemptId);
        addLog("result", `Score: ${review?.grade ?? "N/A"}`);
      } catch (_) {
        addLog("result", "Review not yet available");
      }
    }

    return NextResponse.json({
      success: true,
      attemptId,
      submitted: shouldSubmit,
      totalQuestions: questions.length,
      answered: results.filter(r => r.success).length,
      results,
      review,
      log,
    });

  } catch (err) {
    console.error("AI Solve Error Catch:", err.message);
    return NextResponse.json({ success: false, error: err.message, log }, { status: 500 });
  }
}