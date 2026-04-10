import { 
  startQuizAttempt, 
  getAllQuestions, 
  parseQuestion, 
  submitAnswer, 
  submitQuizAttempt,
  getAttemptResult
} from "./moodleQuizAttempt";
import { solveQuestion, isGeminiConfigurationError } from "./aiQuestionSolver";
import { hasGeminiApiKey } from "./gemini";

const GEMINI_KEY = process.env.GEMINI_API_KEY;

// In-memory store for pending auto-tasks
// In production, use Redis or a DB, but for this app context we'll use a globally scoped Map
if (!global.pendingAutoTasks) {
  global.pendingAutoTasks = new Map();
}

export async function scheduleAutoAttempt(quiz, moodleUrl, token) {
  if (global.pendingAutoTasks.has(quiz.id)) {
    clearTimeout(global.pendingAutoTasks.get(quiz.id));
  }

  const shouldSubmit = quiz.solveMode !== "save";

  const now = Math.floor(Date.now() / 1000);
  const delay = (quiz.timeopen - now + 2) * 1000; // 2s buffer

  console.log(`[Backend Scheduler] Quiz ${quiz.id} scheduled in ${delay}ms`);

  const task = setTimeout(async () => {
    console.log(`[Backend Scheduler] Executing Auto-Attempt for Quiz ${quiz.id}`);
    
    // Initialize status with empty log
    global.lastSolveStatus = global.lastSolveStatus || {};
    global.lastSolveStatus[quiz.id] = { 
      status: 'running', 
      log: [{ step: "init", message: "Backend Auto-Solver started...", ts: Date.now() }],
      results: null 
    };

    const addLog = (step, message) => {
      console.log(`[Backend Scheduler][${quiz.id}][${step}] ${message}`);
      global.lastSolveStatus[quiz.id].log.push({ step, message, ts: Date.now() });
    };

    try {
      if (!hasGeminiApiKey()) {
        const message = "Gemini API key is missing. Set GEMINI_API_KEY in your environment and restart the server.";
        addLog("error", message);
        global.lastSolveStatus[quiz.id].status = 'error';
        global.lastSolveStatus[quiz.id].error = message;
        global.lastSolveStatus[quiz.id].code = 'GEMINI_API_KEY_MISSING';
        return;
      }

      addLog("start", `Starting attempt for quiz ${quiz.id}...`);
      const attempt = await startQuizAttempt(moodleUrl, token, quiz.id);
      const attemptId = attempt.id;
      addLog("start", `Attempt created: ID=${attemptId} state=${attempt.state}`);

      // 2. Fetch all questions
      addLog("fetch", "Fetching all pages of questions...");
      const rawQuestions = await getAllQuestions(moodleUrl, token, attemptId);
      addLog("fetch", `Got ${rawQuestions.length} raw questions`);

      const questions = rawQuestions.map(parseQuestion);
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
            global.lastSolveStatus[quiz.id].status = 'error';
            global.lastSolveStatus[quiz.id].error = aiErr.message;
            global.lastSolveStatus[quiz.id].code = aiErr.code || 'GEMINI_CONFIGURATION_ERROR';
            return;
          }

          addLog("error", `[SLOT ${q.slot}] AI failed — ${aiErr.message}`);
          results.push({ slot: q.slot, success: false, error: aiErr.message });
          continue;
        }

        addLog("ai_result", `[SLOT ${q.slot}] AI Choose ID: ${answer.correct_answer_number} | Name: "${answer.correct_answer_text}"`);
        addLog("ai_reason", `[SLOT ${q.slot}] Reason: ${answer.reasoning} (Confidence: ${answer.confidence})`);

        // Submit answer
        try {
          await submitAnswer(moodleUrl, token, attemptId, q, answer.correct_answer_number);
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
        await submitQuizAttempt(moodleUrl, token, attemptId);
        addLog("finish", "Quiz submitted!");
      } else {
        addLog("finish", "Answers saved only. Quiz attempt left open for manual submission.");
      }

      // 5. Try to get result only after final submit
      let review = null;
      if (shouldSubmit) {
        try {
          review = await getAttemptResult(moodleUrl, token, attemptId);
          addLog("result", `Score: ${review?.grade ?? "N/A"}`);
        } catch (_) {
          addLog("result", "Review not yet available");
        }
      }

      // Update with final results
      global.lastSolveStatus[quiz.id] = { 
        status: 'completed', 
        timestamp: Date.now(), 
        results: { 
          success: true,
          submitted: shouldSubmit,
          attemptId,
          totalQuestions: questions.length,
          answered: results.filter(r => r.success).length,
          results,
          review
        },
        log: [...global.lastSolveStatus[quiz.id].log]
      };
      
      addLog("success", `Auto-Attempt completed successfully!`);
      console.log(`[Backend Scheduler] Auto-Attempt SUCCESS for Quiz ${quiz.id}`);
    } catch (error) {
      console.error(`[Backend Scheduler] Auto-Attempt FAILED for Quiz ${quiz.id}:`, error);
      const errorMessage = error.message || "Unknown error";
      
      if (global.lastSolveStatus[quiz.id]) {
        addLog("error", `Error: ${errorMessage}`);
        global.lastSolveStatus[quiz.id].status = 'error';
        global.lastSolveStatus[quiz.id].error = errorMessage;
      }
    } finally {
      global.pendingAutoTasks.delete(quiz.id);
    }
  }, delay);

  global.pendingAutoTasks.set(quiz.id, task);
}

export function cancelAutoAttempt(quizId) {
  if (global.pendingAutoTasks.has(quizId)) {
    const task = global.pendingAutoTasks.get(quizId);
    clearTimeout(task);
    global.pendingAutoTasks.delete(quizId);
    console.log(`[Backend Scheduler] Quiz ${quizId} unscheduled.`);
    return true;
  }
  return false;
}
