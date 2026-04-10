import { NextResponse } from "next/server";
import { getMoodleConfig } from "@/lib/config";
import { scheduleAutoAttempt, cancelAutoAttempt } from "@/lib/autoScheduler";
import { hasGeminiApiKey } from "@/lib/gemini";

// Store scheduled quizzes globally in development
if (!global.scheduledQuizIds) {
  global.scheduledQuizIds = new Set();
}

export async function POST(request) {
  try {
    const { moodleUrl, token } = getMoodleConfig();
    const { action, quiz, quizId } = await request.json();

    if (action === "schedule") {
      if (!hasGeminiApiKey()) {
        return NextResponse.json(
          {
            success: false,
            code: "GEMINI_API_KEY_MISSING",
            message: "Gemini API key is missing. Set GEMINI_API_KEY in your environment and restart the server.",
          },
          { status: 503 }
        );
      }

      if (quiz && quiz.timeopen > Math.floor(Date.now() / 1000)) {
        await scheduleAutoAttempt(quiz, moodleUrl, token);
        global.scheduledQuizIds.add(quiz.id);
        return NextResponse.json({ success: true, message: `Scheduled auto-solve for quiz ${quiz.id}` });
      }
      return NextResponse.json({ success: false, message: "Quiz not eligible for scheduling" }, { status: 400 });
    }

    if (action === "unschedule") {
      const id = quizId || quiz?.id;
      if (id) {
        cancelAutoAttempt(id);
        global.scheduledQuizIds.delete(id);
        return NextResponse.json({ success: true, message: `Unscheduled quiz ${id}` });
      }
      return NextResponse.json({ success: false, message: "Quiz ID required" }, { status: 400 });
    }

    if (action === "checkStatus") {
      const statuses = global.lastSolveStatus || {};
      return NextResponse.json({ success: true, statuses });
    }

    if (action === "clearStatus") {
      if (!quizId) {
        return NextResponse.json({ success: false, message: "Quiz ID required" }, { status: 400 });
      }

      if (global.lastSolveStatus && global.lastSolveStatus[quizId]) {
        delete global.lastSolveStatus[quizId];
      }

      global.scheduledQuizIds?.delete?.(quizId);
      return NextResponse.json({ success: true, message: `Cleared status for quiz ${quizId}` });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Auto-Attempt API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
