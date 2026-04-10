// app/api/schedule-quiz/route.js

// NOTE: For production use a proper job queue (BullMQ, Inngest, etc.)
// This in-process setTimeout works for demos and single-server deploys.

export async function POST(request) {
  const { quizId, startTime } = await request.json();
  // startTime: Unix timestamp (seconds) — quiz's timeopen

  if (!quizId || !startTime) {
    return Response.json({ error: "quizId and startTime required" }, { status: 400 });
  }

  const nowSec   = Math.floor(Date.now() / 1000);
  const delayMs  = Math.max(0, (startTime - nowSec) * 1000);
  const startsIn = Math.round(delayMs / 1000);

  // Fire-and-forget: schedule the attempt
  setTimeout(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/quizzes/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
    } catch (e) {
      console.error(`Scheduled attempt failed for quiz ${quizId}:`, e.message);
    }
  }, delayMs);

  return Response.json({
    scheduled: true,
    quizId,
    startsInSeconds: startsIn,
    scheduledFor: new Date(startTime * 1000).toISOString(),
  });
}