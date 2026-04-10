"use client";
import { useQuizzes } from "@/hooks/useQuizzes";
import StatsBar from "@/components/StatsBar";
import QuizList from "@/components/QuizList";
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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Quiz Portal</h1>
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Beat AI Generated Quiz with AI</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={refetch}
              className="p-2.5 rounded-xl bg-secondary hover:bg-border-custom transition-all active:scale-95 group"
              title="Refresh Data"
            >
              <svg 
                className={`w-5 h-5 group-active:rotate-180 transition-transform duration-500 ${loading ? "animate-spin" : ""}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest border border-red-500/20"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-12">
        <div className="mb-12 animate-slide-up flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
              Live Moodle Integration
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-3 flex items-center gap-4 tracking-tight">
              Quizzes Overview
              <span className="text-xs font-normal text-text-muted bg-secondary px-3 py-1.5 rounded-2xl border border-border-custom shadow-xs hover:shadow-md transition-shadow cursor-default">{quizzes?.length || 0} Total</span>
            </h2>
            <p className="text-text-muted max-w-lg text-sm md:text-base leading-relaxed">
              Securely track your upcoming assignments, monitor ongoing evaluations, and automate your workflow with our advanced AI solving engine.
            </p>
          </div>

          <div className="w-full lg:w-[380px] rounded-2xl border border-border-custom bg-secondary/40 p-4 md:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary border border-primary/20 flex items-center justify-center text-lg font-black">
                {profileInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Profile</p>
                <p className="text-base font-bold text-foreground truncate">{displayName}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-2">Subjects</p>

              {visibleSubjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {visibleSubjects.map((subject) => (
                    <span
                      key={subject.id}
                      className="px-2.5 py-1 rounded-full bg-background border border-border-custom text-xs text-foreground/90"
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
