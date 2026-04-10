import { NextResponse } from "next/server";
import { callMoodleAPI, getMoodleUserID } from "@/lib/moodle";
import { getQuizAttemptMarks } from "@/lib/moodleQuizAttempt";

const MOODLE_URL = process.env.MOODLE_URL;
const MOODLE_TOKEN = process.env.MOODLE_TOKEN;

export async function GET() {
  try {
    if (!MOODLE_URL || !MOODLE_TOKEN) {
      throw new Error("Moodle configuration is missing");
    }

    // Dynamic user ID using the token
    const userid = await getMoodleUserID(MOODLE_URL, MOODLE_TOKEN);

    // Step 1: get enrolled courses for the user
    const courses = await callMoodleAPI(
      MOODLE_URL, MOODLE_TOKEN,
      "core_enrol_get_users_courses",
      { userid }
    );

    if (!Array.isArray(courses)) {
      throw new Error("Invalid response for courses");
    }

    const courseIds = courses.map((c) => c.id);

    // Step 2: Fetch all quizzes and check for user attempts
    const quizzesRes = await callMoodleAPI(
      MOODLE_URL,
      MOODLE_TOKEN,
      "mod_quiz_get_quizzes_by_courses",
      { courseids: courseIds }
    );

    let allQuizzes = quizzesRes?.quizzes || [];
    const now = Math.floor(Date.now() / 1000);

    // Fetch attempts for all quizzes to detect existing submissions
    const enhancedQuizzes = await Promise.all(
      allQuizzes.map(async (quiz) => {
        try {
          const marks = await getQuizAttemptMarks(MOODLE_URL, MOODLE_TOKEN, quiz.id, userid);

          let status = "past";
          if (quiz.timeopen > now) {
            status = "upcoming";
          } else if (quiz.timeopen <= now && (quiz.timeclose === 0 || quiz.timeclose > now)) {
            status = "current";
          }

          return {
            ...quiz,
            status,
            isUpcoming: status === "upcoming",
            hasFinishedAttempt: marks.finishedAttempts > 0,
            hasInProgressAttempt: marks.inProgressAttempts > 0,
            lastGrade: marks.lastGrade,
            currentGrade: marks.currentGrade,
            totalAttempts: marks.totalAttempts,
            latestAttemptGrade: marks.latestAttemptGrade,
            latestAttemptState: marks.latestAttemptState,
          };
        } catch (e) {
          console.error(`Error fetching attempts for quiz ${quiz.id}:`, e);
          return { ...quiz, status: "unknown" };
        }
      })
    );

    // Sort by timeopen (ascending: past -> future)
    enhancedQuizzes.sort((a, b) => a.timeopen - b.timeopen);

    return NextResponse.json(enhancedQuizzes);
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}
