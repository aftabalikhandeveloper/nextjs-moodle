"use client";
import { useEffect, useMemo, useState } from "react";

function formatTime(unix) {
  if (!unix) return "-";
  return new Date(Number(unix) * 1000).toLocaleString();
}

function normalizeState(schedule, statusEntry) {
  if (statusEntry?.status === "completed") return "completed";
  if (statusEntry?.status === "running") return "in_process";
  if (statusEntry?.status === "error") return "error";
  if (schedule?.status === "running") return "in_process";
  if (schedule?.status === "completed") return "completed";
  if (schedule?.status === "error") return "error";
  return "upcoming";
}

export default function ScheduledQuizStatusPanel() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [clearingQuizId, setClearingQuizId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchSnapshot = async ({ initial = false } = {}) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const res = await fetch("/api/quizzes/auto-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkStatus" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to load Edge Config schedules");
      }

      if (data.warning) {
        setError(data.warning);
      } else {
        setError(null);
      }

      setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
      setStatuses(data.statuses && typeof data.statuses === "object" ? data.statuses : {});
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load scheduler snapshot");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSnapshot({ initial: true });
  }, []);

  const handleClearStatus = async (quizId) => {
    try {
      setClearingQuizId(String(quizId));
      const res = await fetch("/api/quizzes/auto-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearStatus", quizId: String(quizId) }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to clear quiz status");
      }

      setSchedules((prev) => prev.filter((item) => String(item.id) !== String(quizId)));
      setStatuses((prev) => {
        const copy = { ...prev };
        delete copy[String(quizId)];
        return copy;
      });
      setRecommendations((prev) => prev.filter((item) => String(item.quizId) !== String(quizId)));
    } catch (clearError) {
      setError(clearError.message || "Failed to clear scheduler status");
    } finally {
      setClearingQuizId(null);
    }
  };

  const items = useMemo(() => {
    return schedules
      .map((schedule) => {
        const statusEntry = statuses[String(schedule.id)] || null;
        return {
          ...schedule,
          state: normalizeState(schedule, statusEntry),
          statusEntry,
        };
      })
      .sort((a, b) => Number(a.startTime || 0) - Number(b.startTime || 0));
  }, [schedules, statuses]);

  return (
    <section className="mb-8 bg-card border border-border-custom rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Edge Config</p>
          <h3 className="text-lg font-black">Scheduled Quiz Queue</h3>
        </div>
        <div className="text-right space-y-1">
          <div>
            <p className="text-xs text-text-muted">Key</p>
            <p className="text-xs font-black text-primary">quiz_schedules</p>
          </div>
          <button
            type="button"
            onClick={() => fetchSnapshot()}
            disabled={refreshing || loading}
            className="px-2 py-1 rounded-md border border-border-custom text-xs hover:bg-secondary/40 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-text-muted">Loading scheduler snapshot...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : (
        <div className="space-y-3">
          {recommendations.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
              <p className="font-black uppercase tracking-widest">Cleanup recommended</p>
              {recommendations.map((rec) => (
                <div key={`${rec.quizId}-${rec.action}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span>Quiz #{rec.quizId}: {rec.reason}</span>
                  <button
                    type="button"
                    onClick={() => handleClearStatus(rec.quizId)}
                    disabled={clearingQuizId === String(rec.quizId)}
                    className="px-2 py-1 rounded-md border border-amber-400/40 hover:bg-amber-400/10 disabled:opacity-60"
                  >
                    {clearingQuizId === String(rec.quizId) ? "Clearing..." : "Delete stale entry"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {items.length === 0 && (
            <div className="text-sm text-text-muted">No scheduled quizzes in Edge Config yet.</div>
          )}

          {items.map((item) => {
            const isCompleted = item.state === "completed";
            const isRunning = item.state === "in_process";
            const isError = item.state === "error";
            const rowClass = isCompleted
              ? "border-emerald-500/30 bg-emerald-500/10"
              : isRunning
              ? "border-yellow-500/30 bg-yellow-500/10"
              : isError
              ? "border-red-500/30 bg-red-500/10"
              : "border-border-custom bg-secondary/20";

            return (
              <div key={item.id} className={`rounded-xl border p-3 ${rowClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p className="font-black">Quiz #{item.id}</p>
                  <span className="uppercase tracking-widest font-bold">
                    {item.state === "in_process" ? "in process" : item.state}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-foreground/80">
                  <p>Start: {formatTime(item.startTime)}</p>
                  <p>End: {formatTime(item.endTime)}</p>
                  <p>Mode: {item.solveMode || "submit"}</p>
                  <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold">
        <span className="inline-flex items-center gap-1 text-emerald-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed logs
        </span>
        <span className="inline-flex items-center gap-1 text-yellow-500">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span> In-process logs
        </span>
      </div>
    </section>
  );
}
