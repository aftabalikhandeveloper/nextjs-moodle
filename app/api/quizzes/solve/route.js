// app/api/quizzes/solve/route.js
import { NextResponse } from "next/server";
import { solveQuizAttempt } from "@/lib/quizSolver";

export async function POST(request) {
  const { quizId, submitMode = "submit" } = await request.json();
  const result = await solveQuizAttempt({ quizId, submitMode });
  return NextResponse.json(result, { status: result.statusCode || 200 });
}