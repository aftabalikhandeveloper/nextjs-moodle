"use client";

export default function StatsBar({ quizzes }) {
  const total = quizzes.length;
  const activeNow = quizzes.filter((q) => q.status === "current").length;
  const upcoming = quizzes.filter((q) => q.status === "upcoming").length;
  const completed = quizzes.filter((q) => q.status === "past" || q.hasFinishedAttempt).length;

  const stats = [
    { label: "Active Now", value: activeNow, tone: "text-primary", dotTone: "bg-primary" },
    { label: "Upcoming", value: upcoming, tone: "text-amber-700 dark:text-amber-300", dotTone: "bg-amber-500" },
    { label: "Total Quizzes", value: total, tone: "text-foreground", dotTone: "bg-foreground/70", meta: `${completed} completed` },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {stats.map((s) => (
        <div 
          key={s.label} 
          className="bg-card border border-border-custom p-3 sm:p-4 rounded-xl flex items-center gap-3 transition-all hover:shadow-md"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-secondary border border-border-custom shrink-0">
              <div className={`w-2 h-2 rounded-full ${s.dotTone}`}></div>
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-text-muted leading-tight">{s.label}</div>
            <div className={`text-xl sm:text-2xl font-black tracking-tight leading-tight ${s.tone}`}>{s.value}</div>
            {s.meta && <div className="text-[10px] text-text-muted mt-0.5">{s.meta}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
