"use client";
import { useQuizzes } from "@/hooks/useQuizzes";
import StatsBar from "@/components/StatsBar";
import QuizList from "@/components/QuizList";
import ScheduledQuizStatusPanel from "@/components/ScheduledQuizStatusPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { quizzes, loading, error, refetch } = useQuizzes();
  const router = useRouter();
  const [userInfo, setUserInfo] = useState({ username: "", subjects: [] });
  const displayName = userInfo.username || "User";
  const profileInitial = displayName.charAt(0).toUpperCase();
  const visibleSubjects = userInfo.subjects.slice(0, 5);
  const remainingSubjects = Math.max(userInfo.subjects.length - visibleSubjects.length, 0);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch("/api/user-info");
        const data = await res.json();

        if (!res.ok || data.error) {
          return;
        }

        setUserInfo({
          username: data.username || "",
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
        });
      } catch {
      }
    };

    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border-custom bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col justify-center">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground leading-tight">Quiz Portal</h1>
            <p className="block text-[8px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest text-text-muted font-bold truncate max-w-[145px] sm:max-w-none">Beat AI Quizez with AI</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle iconOnlyOnMobile className="px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide" />
            <button 
              onClick={refetch}
              className="p-2 sm:p-2.5 rounded-xl bg-secondary hover:bg-border-custom transition-all active:scale-95 group"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <svg 
                className={`w-4 h-4 sm:w-5 sm:h-5 group-active:rotate-180 transition-transform duration-500 ${loading ? "animate-spin" : ""}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button 
              onClick={handleLogout}
              className="px-2.5 sm:px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] sm:text-xs font-black uppercase tracking-wide border border-red-500/20"
              title="Logout"
              aria-label="Logout"
            >
              <span className="sm:hidden" aria-hidden="true">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-7">
        <div className="mb-7 animate-slide-up grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 xl:gap-5 items-stretch">
          <div className="rounded-2xl border border-border-custom bg-card/70 p-4 sm:p-5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              Live Moodle Integration
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-2 flex flex-wrap items-center gap-3 tracking-tight leading-tight">
              Quizzes Overview
              <span className="text-xs font-semibold text-text-muted bg-secondary px-2.5 py-1 rounded-full border border-border-custom cursor-default">{quizzes?.length || 0} Total</span>
            </h2>
            <p className="text-text-muted max-w-2xl text-sm md:text-base leading-relaxed">
              Securely track your upcoming assignments, monitor ongoing evaluations, and automate your workflow with our advanced AI solving engine.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-border-custom bg-secondary/35 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/20 flex items-center justify-center text-lg font-black shrink-0">
                  {profileInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Profile</p>
                  <p className="text-xl font-black text-foreground truncate leading-tight">{displayName}</p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-1 shrink-0">
                {userInfo.subjects.length} subjects
              </span>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-2">Subjects</p>

              {visibleSubjects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {visibleSubjects.map((subject) => (
                    <span
                      key={subject.id}
                      className="px-2.5 py-1 rounded-full bg-background border border-border-custom text-xs text-foreground/90 leading-tight"
                      title={subject.name}
                    >
                      {subject.name}
                    </span>
                  ))}

                  {remainingSubjects > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">
                      +{remainingSubjects} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No subjects enrolled</p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {!loading ? (
          <>
            <ScheduledQuizStatusPanel />
            <StatsBar quizzes={quizzes || []} />
            <QuizList quizzes={quizzes || []} />
          </>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {[1,2,3].map(i => <div key={i} className="h-32 bg-secondary rounded-2xl animate-pulse"></div>)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-secondary rounded-2xl animate-pulse"></div>)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
