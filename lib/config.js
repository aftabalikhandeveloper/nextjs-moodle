// lib/config.js

/**
 * Common configuration utility for Moodle credentials.
 * This ensures consistency across API routes and background schedulers.
 */
export function getMoodleConfig() {
  const moodleUrl = process.env.MOODLE_URL || "https://moodle.example.com";
  const token = process.env.MOODLE_TOKEN;

  if (!token) {
    throw new Error("MOODLE_TOKEN environment variable is not set.");
  }

  return { moodleUrl, token };
}
