import { NextResponse } from "next/server";
import {
  ensureStoreInitialized,
  getScheduledQuizzes,
  getDueScheduledQuizzes,
  markScheduleState,
  setQuizStatus,
  removeScheduledQuiz,
  clearQuizStatus,
} from "@/lib/edgeQuizStore";
import { solveQuizAttempt } from "@/lib/quizSolver";

function isCronAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret?.trim()) return true;

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  return bearerToken === cronSecret || querySecret === cronSecret;
}

async function runAutoSolve(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized cron call" }, { status: 401 });
  }

  await ensureStoreInitialized();

  const now = Math.floor(Date.now() / 1000);
  const schedules = await getScheduledQuizzes();
  const dueSchedules = getDueScheduledQuizzes(schedules, now);

  const processed = [];
  const warnings = [];

  const safeEdgeWrite = async (label, fn) => {
    try {
      await fn();
      return true;
    } catch (error) {
      warnings.push({
        step: label,
        code: error?.code || "EDGE_WRITE_FAILED",
        message: error?.message || "Unknown Edge Config write error",
      });
      return false;
    }
  };

  for (const schedule of dueSchedules) {
    const quizId = String(schedule.id);

    await safeEdgeWrite(`mark-running:${quizId}`, () => markScheduleState(quizId, "running"));
    await safeEdgeWrite(`set-running-status:${quizId}`, () =>
      setQuizStatus(quizId, {
      status: "running",
      log: [{ step: "init", message: "Cron Auto-Solver started...", ts: Date.now() }],
      results: null,
      })
    );

    const result = await solveQuizAttempt({ quizId, submitMode: schedule.solveMode || "submit" });

    if (result.success) {
      await safeEdgeWrite(`remove-schedule:${quizId}`, () => removeScheduledQuiz(quizId));
      await safeEdgeWrite(`clear-status:${quizId}`, () => clearQuizStatus(quizId));
      processed.push({ quizId, success: true });
      continue;
    }

    await safeEdgeWrite(`set-error-status:${quizId}`, () =>
      setQuizStatus(quizId, {
        status: "error",
        error: result.error || "Unknown error",
        code: result.code,
        log: result.log || [],
        results: result.results || null,
      })
    );
    await safeEdgeWrite(`remove-failed-schedule:${quizId}`, () => removeScheduledQuiz(quizId));
    await safeEdgeWrite(`clear-failed-status:${quizId}`, () => clearQuizStatus(quizId));
    processed.push({ quizId, success: false, error: result.error || "Unknown error" });
  }

  return NextResponse.json({
    success: true,
    edgeConfigKey: "quiz_schedules",
    now,
    totalScheduled: schedules.length,
    dueCount: dueSchedules.length,
    processed,
    warnings,
  });
}

export async function GET(request) {
  try {
    return await runAutoSolve(request);
  } catch (error) {
    const code = error?.code || "CRON_AUTO_SOLVE_ERROR";
    const isConfigError = code === "EDGE_CONFIG_INVALID" || code === "EDGE_CONFIG_MISSING";
    return NextResponse.json(
      { success: false, code, error: error.message },
      { status: isConfigError ? 503 : 500 }
    );
  }
}

export async function POST(request) {
  try {
    return await runAutoSolve(request);
  } catch (error) {
    const code = error?.code || "CRON_AUTO_SOLVE_ERROR";
    const isConfigError = code === "EDGE_CONFIG_INVALID" || code === "EDGE_CONFIG_MISSING";
    return NextResponse.json(
      { success: false, code, error: error.message },
      { status: isConfigError ? 503 : 500 }
    );
  }
}