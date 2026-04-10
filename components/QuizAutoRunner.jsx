"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export default function QuizAutoRunner({ quiz }) {
  const [autoEnabled, setAutoEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`auto_solve_${quiz.id}`) === "true";
  });
  const [solveMode, setSolveMode] = useState(() => {
    if (typeof window === "undefined") return "submit";
    return localStorage.getItem(`quiz_solve_mode_${quiz.id}`) || "submit";
  });
  const [status, setStatus] = useState("idle");
  const checkStatusInterval = useRef(null);

  const isUpcoming = quiz.status === "upcoming";

  const scheduleOnBackend = useCallback(async (shouldEnable = true, mode = solveMode) => {
    try {
      const res = await fetch("/api/quizzes/auto-solve", {
        method: "POST",
        body: JSON.stringify({ 
          action: shouldEnable ? "schedule" : "unschedule", 
          quiz: { ...quiz, solveMode: mode },
          quizId: quiz.id
        }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        setStatus(shouldEnable ? "Scheduled on Server" : "idle");
      } else {
        const message = data.message || data.error || "Failed to schedule auto-solve";
        setStatus("Server Error ❌");
        window.dispatchEvent(new CustomEvent('quiz_solve_error', {
          detail: { quizId: quiz.id, message }
        }));
      }
    } catch (e) {
      console.error("Failed to sync auto-solve status to backend", e);
      window.dispatchEvent(new CustomEvent('quiz_solve_error', {
        detail: { quizId: quiz.id, message: e.message || "Failed to sync with backend" }
      }));
    }
  }, [quiz, solveMode]);

  // Register saved auto-solve state with backend on mount
  useEffect(() => {
    if (autoEnabled && isUpcoming) {
      const syncSavedAutoSolve = async () => {
        try {
          await fetch("/api/quizzes/auto-solve", {
            method: "POST",
            body: JSON.stringify({
              action: "schedule",
              quiz: { ...quiz, solveMode },
              quizId: quiz.id
            }),
            headers: { "Content-Type": "application/json" }
          });
        } catch (e) {
          window.dispatchEvent(new CustomEvent('quiz_solve_error', {
            detail: { quizId: quiz.id, message: e.message || "Failed to sync with backend" }
          }));
        }
      };

      syncSavedAutoSolve();
    }
  }, [autoEnabled, isUpcoming, quiz]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`quiz_solve_mode_${quiz.id}`, solveMode);
  }, [quiz.id, solveMode]);

  // 2. Poll Backend Status if Auto is On
  useEffect(() => {
    if (autoEnabled) {
      checkStatusInterval.current = setInterval(async () => {
        try {
          const res = await fetch("/api/quizzes/auto-solve", {
            method: "POST",
            body: JSON.stringify({ action: "checkStatus" }),
            headers: { "Content-Type": "application/json" }
          });
          const data = await res.json();
          if (data.statuses && data.statuses[quiz.id]) {
            const quizStatus = data.statuses[quiz.id];
            
            // Sync status and log to QuizCard if it's running
            if (quizStatus.status === 'running' || quizStatus.status === 'completed') {
              window.dispatchEvent(new CustomEvent('quiz_solve_started', { 
                detail: { 
                    quizId: quiz.id, 
                    log: quizStatus.log || [{ message: "Processing..." }]
                } 
              }));
            }

            if (quizStatus.status === 'completed') {
               setStatus(quizStatus.results?.submitted === false ? "Answers Saved on LMS ⏸" : "Attempted by AI Server ✅");
               // Trigger UI card update by custom event
               window.dispatchEvent(new CustomEvent('quiz_solve_completed', { 
                 detail: { quizId: quiz.id, data: quizStatus.results } 
               }));
               // Stop polling once completed
               clearInterval(checkStatusInterval.current);
            } else if (quizStatus.status === 'error') {
               const message = quizStatus.error || "Server Error ❌";
               setStatus("Server Error ❌");
               window.dispatchEvent(new CustomEvent('quiz_solve_error', {
                 detail: { quizId: quiz.id, message }
               }));
               clearInterval(checkStatusInterval.current);
            }
          }
        } catch (e) { console.error("Status check failed", e); }
      }, 3000); // Polling faster (3s) for better responsiveness
      return () => clearInterval(checkStatusInterval.current);
    }
  }, [autoEnabled, quiz.id]);

  const handleToggle = () => {
    const newValue = !autoEnabled;
    setAutoEnabled(newValue);
    const key = `auto_solve_${quiz.id}`;
    localStorage.setItem(key, newValue.toString());
    
    if (isUpcoming) {
      scheduleOnBackend(newValue, solveMode);
    }
  };

  const handleModeChange = (event) => {
    const nextMode = event.target.value;
    setSolveMode(nextMode);

    if (autoEnabled && isUpcoming) {
      scheduleOnBackend(true, nextMode);
    }
  };

  if (!isUpcoming || quiz.timeopen === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-2xl border border-primary/10 bg-primary/5 flex items-center justify-between group transition-all">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl border transition-colors ${autoEnabled ? 'bg-primary text-white border-primary' : 'bg-secondary border-border-custom opacity-50' } shadow-sm`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-black uppercase tracking-widest text-primary">Server Auto-Solver</p>
          <p className="text-[10px] opacity-60 font-medium whitespace-nowrap">Answers can be saved only or fully submitted</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] uppercase tracking-widest font-bold text-text-muted">Mode</span>
            <select
              value={solveMode}
              onChange={handleModeChange}
              className="text-[10px] bg-background border border-border-custom rounded-lg px-2 py-1 text-foreground outline-none focus:border-primary"
            >
              <option value="save">Save only</option>
              <option value="submit">Save + submit</option>
            </select>
          </div>
          {status !== 'idle' && (
            <div className="flex items-center gap-1.5 mt-1.5 animate-pulse">
              <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
              <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">{status}</p>
            </div>
          )}
        </div>
      </div>
      
      <button 
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          autoEnabled ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-600'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 ${autoEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
