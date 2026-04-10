import { NextResponse } from "next/server";
import { hasGeminiApiKey } from "@/lib/gemini";
import {
  upsertScheduledQuiz,
  removeScheduledQuiz,
  getSchedulerSnapshot,
  clearQuizStatus,
  getCleanupRecommendations,
} from "@/lib/edgeQuizStore";

export async function POST(request) {
  try {
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
        const scheduled = await upsertScheduledQuiz(quiz);
        return NextResponse.json({
          success: true,
          message: `Scheduled auto-solve for quiz ${quiz.id}`,
          quiz: scheduled,
        });
      }
      return NextResponse.json({ success: false, message: "Quiz not eligible for scheduling" }, { status: 400 });
    }

    if (action === "unschedule") {
      const id = quizId || quiz?.id;
      if (id) {
        await removeScheduledQuiz(id);
        return NextResponse.json({ success: true, message: `Unscheduled quiz ${id}` });
      }
      return NextResponse.json({ success: false, message: "Quiz ID required" }, { status: 400 });
    }

    if (action === "checkStatus") {
      try {
        const { statuses, schedules } = await getSchedulerSnapshot();
        const recommendations = getCleanupRecommendations(schedules, statuses);
        return NextResponse.json({ success: true, statuses, schedules, recommendations });
      } catch (error) {
        if (error?.code === "EDGE_CONFIG_INVALID" || error?.code === "EDGE_CONFIG_MISSING") {
          return NextResponse.json({
            success: true, // Return 200 to prevent Next.js from spamming the console with 5xx access logs
            warning: "⚠️ Edge Config is missing or invalid. Set it up to view schedules.",
            statuses: {},
            schedules: [],
            recommendations: [],
          });
        }
        throw error; // Re-throw if it's not a generic config error
      }
    }

    if (action === "clearStatus") {
      if (!quizId) {
        return NextResponse.json({ success: false, message: "Quiz ID required" }, { status: 400 });
      }

      await clearQuizStatus(quizId);
      await removeScheduledQuiz(quizId);
      return NextResponse.json({ success: true, message: `Cleared status for quiz ${quizId}` });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error) {
    const code = error?.code || "AUTO_SOLVE_API_ERROR";
    const isConfigError = code === "EDGE_CONFIG_INVALID" || code === "EDGE_CONFIG_MISSING";

    if (!isConfigError) {
      console.error("Auto-Attempt API error:", error);
    } else {
      console.warn(`[Auto-Attempt] ${error.message} (ignoring stack trace to prevent log spam)`);
    }

    return NextResponse.json(
      {
        success: false,
        code,
        error: error.message,
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}
