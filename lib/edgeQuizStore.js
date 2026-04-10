import { get } from "@vercel/edge-config";

const EDGE_QUIZ_SCHEDULES_KEY = "quiz_schedules";
const EDGE_QUIZ_STATUSES_KEY = "quiz_statuses";

function extractEdgeConfigId(connectionString = "") {
  const match = String(connectionString).match(/ecfg_[a-z0-9]+/i);
  return match ? match[0] : null;
}

function getStoreConfig() {
  const edgeConfigId = process.env.EDGE_CONFIG_ID || extractEdgeConfigId(process.env.EDGE_CONFIG);
  const vercelApiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId?.trim()) {
    throw new Error("Set EDGE_CONFIG_ID in .env or provide EDGE_CONFIG connection string containing ecfg_... ID.");
  }

  return { edgeConfigId, vercelApiToken };
}

function createConfigError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapEdgeConfigReadError(error) {
  const message = error?.message || "Edge Config read failed.";

  if (message.includes("Invalid connection string provided")) {
    return createConfigError(
      "EDGE_CONFIG is invalid. Paste the full Edge Config connection string (includes token), then restart the server.",
      "EDGE_CONFIG_INVALID"
    );
  }

  if (message.includes("EDGE_CONFIG") && message.includes("not found")) {
    return createConfigError("EDGE_CONFIG environment variable is missing.", "EDGE_CONFIG_MISSING");
  }

  return error;
}

async function getEdgeValue(key, fallbackValue) {
  try {
    const value = await get(key);
    return value ?? fallbackValue;
  } catch (error) {
    throw mapEdgeConfigReadError(error);
  }
}

async function patchEdgeConfigItems(items) {
  const { edgeConfigId, vercelApiToken } = getStoreConfig();

  if (!vercelApiToken?.trim()) {
    throw new Error("VERCEL_API_TOKEN is required for writing to Edge Config.");
  }

  const response = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${vercelApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Edge Config update failed (${response.status}): ${text}`);
  }
}

export async function ensureStoreInitialized() {
  const schedules = await getEdgeValue(EDGE_QUIZ_SCHEDULES_KEY, []);
  const statuses = await getEdgeValue(EDGE_QUIZ_STATUSES_KEY, {});

  const missingItems = [];

  if (!Array.isArray(schedules)) {
    missingItems.push({
      operation: "upsert",
      key: EDGE_QUIZ_SCHEDULES_KEY,
      value: [],
    });
  }

  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses)) {
    missingItems.push({
      operation: "upsert",
      key: EDGE_QUIZ_STATUSES_KEY,
      value: {},
    });
  }

  if (missingItems.length > 0) {
    await patchEdgeConfigItems(missingItems);
  }
}

function normalizeSchedule(quiz) {
  return {
    id: String(quiz.id),
    startTime: Number(quiz.timeopen || 0),
    endTime: Number(quiz.timeclose || 0),
    solveMode: quiz.solveMode || "submit",
    status: "scheduled",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function getScheduledQuizzes() {
  await ensureStoreInitialized();
  const schedules = await getEdgeValue(EDGE_QUIZ_SCHEDULES_KEY, []);
  return Array.isArray(schedules) ? schedules : [];
}

export async function getStatuses() {
  await ensureStoreInitialized();
  const statuses = await getEdgeValue(EDGE_QUIZ_STATUSES_KEY, {});
  return statuses && typeof statuses === "object" ? statuses : {};
}

export async function getSchedulerSnapshot() {
  const [schedules, statuses] = await Promise.all([getScheduledQuizzes(), getStatuses()]);
  return { schedules, statuses };
}

export function getCleanupRecommendations(schedules, statuses, nowUnixSeconds = Math.floor(Date.now() / 1000)) {
  const normalizedSchedules = Array.isArray(schedules) ? schedules : [];
  const normalizedStatuses = statuses && typeof statuses === "object" ? statuses : {};
  const scheduleIds = new Set(normalizedSchedules.map((item) => String(item.id)));
  const nowMs = nowUnixSeconds * 1000;

  const scheduleBased = normalizedSchedules
    .map((schedule) => {
      const id = String(schedule.id);
      const statusEntry = normalizedStatuses[id] || null;
      const scheduleStatus = String(schedule.status || "scheduled");
      const statusState = String(statusEntry?.status || "");
      const endTime = Number(schedule.endTime || 0);
      const shouldCleanupBecauseCompleted = statusState === "completed";
      const shouldCleanupBecauseExpiredRunning = scheduleStatus === "running" && endTime > 0 && nowUnixSeconds > endTime;

      if (!shouldCleanupBecauseCompleted && !shouldCleanupBecauseExpiredRunning) {
        return null;
      }

      return {
        quizId: id,
        action: "clearStatus",
        reason: shouldCleanupBecauseCompleted
          ? "Quiz attempt is completed. Schedule can be deleted."
          : "Quiz window has ended while schedule stayed running. Delete stale schedule.",
      };
    })
    .filter(Boolean);

  const statusOnly = Object.entries(normalizedStatuses)
    .map(([quizId, statusEntry]) => {
      const hasSchedule = scheduleIds.has(String(quizId));
      const state = String(statusEntry?.status || "");
      const updatedAt = Number(statusEntry?.updatedAt || 0);
      const staleMs = updatedAt > 0 ? nowMs - updatedAt : 0;
      const isOrphanRunning = !hasSchedule && state === "running" && staleMs > 60_000;

      if (!isOrphanRunning) {
        return null;
      }

      return {
        quizId: String(quizId),
        action: "clearStatus",
        reason: "Schedule was removed but status is still running. Delete orphan status entry.",
      };
    })
    .filter(Boolean);

  const dedup = new Map();
  for (const item of [...scheduleBased, ...statusOnly]) {
    dedup.set(`${item.quizId}:${item.action}`, item);
  }

  return Array.from(dedup.values());
}

export async function upsertScheduledQuiz(quiz) {
  const schedule = normalizeSchedule(quiz);
  const schedules = await getScheduledQuizzes();
  const nextSchedules = schedules.filter((item) => String(item.id) !== schedule.id);
  nextSchedules.push(schedule);

  await patchEdgeConfigItems([
    {
      operation: "upsert",
      key: EDGE_QUIZ_SCHEDULES_KEY,
      value: nextSchedules,
    },
  ]);

  return schedule;
}

export async function removeScheduledQuiz(quizId) {
  const id = String(quizId);
  const schedules = await getScheduledQuizzes();
  const nextSchedules = schedules.filter((item) => String(item.id) !== id);

  await patchEdgeConfigItems([
    {
      operation: "upsert",
      key: EDGE_QUIZ_SCHEDULES_KEY,
      value: nextSchedules,
    },
  ]);

  return nextSchedules.length !== schedules.length;
}

export async function setQuizStatus(quizId, statusPayload) {
  const id = String(quizId);
  const statuses = await getStatuses();
  statuses[id] = {
    ...(statuses[id] || {}),
    ...statusPayload,
    updatedAt: Date.now(),
  };

  await patchEdgeConfigItems([
    {
      operation: "upsert",
      key: EDGE_QUIZ_STATUSES_KEY,
      value: statuses,
    },
  ]);

  return statuses[id];
}

export async function clearQuizStatus(quizId) {
  const id = String(quizId);
  const statuses = await getStatuses();
  if (statuses[id]) {
    delete statuses[id];
  }

  await patchEdgeConfigItems([
    {
      operation: "upsert",
      key: EDGE_QUIZ_STATUSES_KEY,
      value: statuses,
    },
  ]);
}

export function getDueScheduledQuizzes(schedules, nowUnixSeconds) {
  return schedules.filter((quiz) => {
    const start = Number(quiz.startTime || 0);
    const end = Number(quiz.endTime || 0);

    const isOpen = nowUnixSeconds >= start;
    const isNotClosed = end <= 0 || nowUnixSeconds <= end;
    const isActiveStatus = !quiz.status || quiz.status === "scheduled";

    return isOpen && isNotClosed && isActiveStatus;
  });
}

export async function markScheduleState(quizId, nextState) {
  const id = String(quizId);
  const schedules = await getScheduledQuizzes();
  const nextSchedules = schedules.map((item) => {
    if (String(item.id) !== id) return item;
    return {
      ...item,
      status: nextState,
      updatedAt: Date.now(),
      lastTriggeredAt: Date.now(),
    };
  });

  await patchEdgeConfigItems([
    {
      operation: "upsert",
      key: EDGE_QUIZ_SCHEDULES_KEY,
      value: nextSchedules,
    },
  ]);
}