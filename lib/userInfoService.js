import { getSession } from "@/lib/auth";
import { getMoodleConfig } from "@/lib/config";
import { callMoodleAPI, getMoodleUserID } from "@/lib/moodle";

export async function getUserInfo() {
  const session = await getSession();

  if (!session?.username) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  const { moodleUrl, token } = getMoodleConfig();
  const userid = await getMoodleUserID(moodleUrl, token);

  const courses = await callMoodleAPI(
    moodleUrl,
    token,
    "core_enrol_get_users_courses",
    { userid }
  );

  const subjects = Array.isArray(courses)
    ? courses.map((course) => ({
        id: course.id,
        name: course.fullname || course.shortname || "Untitled Subject",
      }))
    : [];

  return {
    username: session.username,
    subjects,
  };
}