import { NextResponse } from "next/server";
import { callMoodleAPI, getMoodleUserID } from "@/lib/moodle";

const MOODLE_URL = process.env.MOODLE_URL;
const MOODLE_TOKEN = process.env.MOODLE_TOKEN;

export async function GET() {
  try {
    if (!MOODLE_URL || !MOODLE_TOKEN) {
      throw new Error("Moodle configuration is missing");
    }

    // Get the dynamic user ID using the token
    const userid = await getMoodleUserID(MOODLE_URL, MOODLE_TOKEN);

    // Get enrolled courses for the user
    const courses = await callMoodleAPI(
      MOODLE_URL,
      MOODLE_TOKEN,
      "core_enrol_get_users_courses",
      { userid }
    );

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}
