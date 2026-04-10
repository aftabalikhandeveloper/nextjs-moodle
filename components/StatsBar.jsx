"use client";

export default function StatsBar({ quizzes }) {
  const now = Math.floor(Date.now() / 1000);
  const week = now + 7 * 86400;

  const total = quizzes.length;
  const open = quizzes.filter(q => q.status === "current" || (q.timeopen <= now && (!q.timeclose || q.timeclose > now))).length;
  const upcoming = quizzes.filter(q => q.status === "upcoming" || q.timeopen > now).length;

  const stats = [
    { label: "Active Now", value: open, color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
    { label: "Upcoming", value: upcoming, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
    { label: "Total Quizzes", value: total, color: "#6366f1", bg: "rgba(99, 102, 241, 0.1)" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {stats.map((s) => (
        <div 
          key={s.label} 
          className="bg-card border border-border-custom p-6 rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
          </div>
          <div>
            <div className="text-sm font-medium text-text-muted">{s.label}</div>
            <div className="text-2xl font-bold tracking-tight">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
