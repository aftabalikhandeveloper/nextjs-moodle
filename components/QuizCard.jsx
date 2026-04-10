"use client";
import { useState, useEffect } from "react";
import QuizAutoRunner from "./QuizAutoRunner";

function fmt(ts) {
  if (!ts) return "N/A";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function fmtDuration(secs) {
  if (!secs) return "No limit";
  const m = Math.round(secs / 60);
  return m >= 60 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : m + "m";
}

export default function QuizCard({ quiz: q }) {
  const [solving, setSolving] = useState(false);
  const [solveLog, setSolveLog] = useState("");
  const [results, setResults] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [hasLocalHistory, setHasLocalHistory] = useState(false);
  const [userMessage, setUserMessage] = useState(null);

  // Sync state with AutoRunner
  useEffect(() => {
    const handleStart = (e) => {
      if (e.detail.quizId === q.id) {
        setSolving(true);
        // If a log array is provided from backend polling, show the latest message
        if (e.detail.log && Array.isArray(e.detail.log)) {
          const latest = e.detail.log[e.detail.log.length - 1];
          setSolveLog(`Server: ${latest.message}`);
        } else {
          setSolveLog("Auto-Attempt Triggered...");
        }
      }
    };
    
    const handleCompleted = (e) => {
      if (e.detail.quizId === q.id) {
        setSolving(false);
        setResults(e.detail.data);
        setHasLocalHistory(true);
        setShowModal(true);
        setSolveLog(e.detail.data?.submitted === false ? "Saved only!" : "Success!");
        setUserMessage(null);
        // Save to history
        localStorage.setItem(`quiz_history_${q.id}`, JSON.stringify({
          timestamp: Date.now(),
          data: e.detail.data
        }));
      }
    };

    const handleError = (e) => {
      if (e.detail.quizId === q.id) {
        setSolving(false);
        setSolveLog(`Error: ${e.detail.message}`);
        setUserMessage({ type: "error", text: e.detail.message });
      }
    };

    window.addEventListener('quiz_solve_started', handleStart);
    window.addEventListener('quiz_solve_completed', handleCompleted);
    window.addEventListener('quiz_solve_error', handleError);
    return () => {
      window.removeEventListener('quiz_solve_started', handleStart);
      window.removeEventListener('quiz_solve_completed', handleCompleted);
      window.removeEventListener('quiz_solve_error', handleError);
    };
  }, [q.id]);

  const getSolveMode = () => {
    if (typeof window === "undefined") return "submit";
    return localStorage.getItem(`quiz_solve_mode_${q.id}`) || "submit";
  };

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`quiz_history_${q.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Auto-delete if older than 7 days
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > oneWeek) {
          localStorage.removeItem(`quiz_history_${q.id}`);
          setHasLocalHistory(false);
        } else {
          setResults(parsed.data);
          setHasLocalHistory(true);
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [q.id]);

  const now = Math.floor(Date.now() / 1000);
  const status = q.status || (q.timeopen > now ? "upcoming" : (q.timeclose > now || q.timeclose === 0 ? "current" : "past"));
  const canSolve = status === "current" && !q.hasFinishedAttempt && !q.hasInProgressAttempt;

  const handleSolveWithAI = async () => {
    const solveMode = getSolveMode();
    const saveOnly = solveMode === "save";
    const promptMessage = saveOnly
      ? "Start AI Solving? Answers will be saved on Moodle, but the attempt will not be submitted."
      : "Start AI Solving? This will submit a real attempt.";

    if (!confirm(promptMessage)) return;
    setSolving(true);
    setSolveLog("Starting AI Solver...");

    try {
      const res = await fetch("/api/quizzes/solve", {
        method: "POST",
        body: JSON.stringify({ quizId: q.id, submitMode: solveMode }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      
      if (data.success) {
        setResults(data);
        setHasLocalHistory(true);
        setShowModal(true);
        setSolveLog(data.submitted === false ? "Saved only!" : "Success!");
        setUserMessage(null);
        // Save to history with 1 week expiration logic
        localStorage.setItem(`quiz_history_${q.id}`, JSON.stringify({
          timestamp: Date.now(),
          data: data
        }));
      } else {
        setSolveLog("Error: " + data.error);
        setUserMessage({ type: "error", text: data.error || "Failed to solve quiz" });
      }
    } catch (e) {
      setSolveLog("Error: " + e.message);
      setUserMessage({ type: "error", text: e.message || "Unexpected error" });
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className="bg-card border border-border-custom rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-2xl hover:border-primary/30 group relative overflow-hidden animate-fade-in text-foreground">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500"></div>

      {solving && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="relative w-16 h-16 mb-4">
             <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
             <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-lg font-bold text-primary animate-pulse">{solveLog}</p>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
              status === 'current' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
              status === 'upcoming' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
              'bg-gray-500/10 text-gray-500 border-gray-500/20'
            }`}>
              {status}
            </span>
            {q.hasFinishedAttempt && (
              <span className="text-[10px] font-black uppercase bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-md border border-purple-500/20">
                Attempted
              </span>
            )}
          </div>
          <h3 className="font-bold text-xl leading-snug group-hover:text-primary transition-colors pr-4">
            {q.name}
          </h3>
        </div>
        <p className="text-xs font-mono opacity-30">#{q.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2 opacity-80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary rounded-lg">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold opacity-50 tracking-wider">Duration</p>
            <p className="text-sm font-semibold tracking-tight">{fmtDuration(q.timelimit)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary rounded-lg">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold opacity-50 tracking-wider">Attempted</p>
            <p className="text-sm font-semibold tracking-tight">{q.hasFinishedAttempt ? "Yes" : "No"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary rounded-lg">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l7 3-7 3" /></svg>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold opacity-50 tracking-wider">Marks</p>
            <p className="text-sm font-semibold tracking-tight">
              {q.lastGrade ?? q.currentGrade ?? q.latestAttemptGrade ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-2">
        {userMessage && (
          <div className={`w-full p-3 rounded-xl border text-xs font-semibold flex items-start justify-between gap-3 ${
            userMessage.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-500"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
          }`}>
            <span>{userMessage.text}</span>
            <button
              onClick={() => setUserMessage(null)}
              className="hover:bg-foreground/10 rounded-md p-1 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary/30 border border-border-custom shadow-inner">
           <div className="flex flex-col gap-0.5">
             <span className="font-medium text-xs text-text-muted">Starts: {q.timeopen ? fmt(q.timeopen) : "Always"}</span>
             <span className="font-medium text-xs">Ends: {q.timeclose ? fmt(q.timeclose) : "No deadline"}</span>
           </div>
        </div>
        
        {/* Show history if it exists, regardless of timing */}
        {hasLocalHistory && results && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-bold py-3.5 rounded-xl border border-border-custom transition-all flex items-center justify-center gap-2 active:scale-[0.95] group/hist mb-2"
          >
            <svg className="w-4 h-4 opacity-50 group-hover/hist:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            View Solve Results
          </button>
        )}

        {/* 1. UPCOMING: Show Auto-Solve Toggle */}
        {status === 'upcoming' && !results && (
            <QuizAutoRunner quiz={q} />
        )}

        {/* 2. OPEN: Show Solve with AI button (only if NOT solved yet) */}
        {canSolve && (
           <button
             onClick={handleSolveWithAI}
             className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2 group/btn active:scale-[0.98]"
           >
             <svg className="w-5 h-5 group-hover/btn:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             Solve with AI Now
           </button>
        )}

        {/* 3. PAST/ALREADY ATTEMPTED: Status message if no results logic */}
        {!canSolve && !results && status !== 'upcoming' && (
          <div className="w-full bg-secondary/50 text-text-muted flex items-center justify-center gap-2 py-3.5 rounded-xl cursor-not-allowed text-xs font-bold uppercase tracking-widest border border-border-custom/50">
            {q.hasFinishedAttempt ? "Already Attempted" : "Quiz Unavailable"}
          </div>
        )}
      </div>

      {showModal && results && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-card border border-border-custom w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border-custom bg-gradient-to-r from-primary/10 to-transparent flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-primary">Attempt Review</h2>
                <p className="text-text-muted text-sm font-medium">Quiz ID: #{q.id} • Score: {results.review?.grade || "N/A"}</p>
              </div>
              <div className="flex items-center gap-3">
                {results && (
                  <button 
                    onClick={async () => {
                      if (confirm("Delete this history?")) {
                        localStorage.removeItem(`quiz_history_${q.id}`);
                        localStorage.removeItem(`auto_solve_${q.id}`);

                        try {
                          await fetch("/api/quizzes/auto-solve", {
                            method: "POST",
                            body: JSON.stringify({ action: "clearStatus", quizId: q.id }),
                            headers: { "Content-Type": "application/json" }
                          });
                        } catch {
                        }

                        setHasLocalHistory(false);
                        setResults(null);
                        setShowModal(false);
                        setUserMessage({ type: "info", text: "Quiz history deleted." });
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                    title="Delete History"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-6 md:p-8 space-y-8">
              {results.results?.map((res, i) => (
                <div key={i} className="bg-secondary/30 rounded-2xl border border-border-custom overflow-hidden group/item hover:border-primary/20 transition-all">
                  <div className="p-5 border-b border-border-custom bg-secondary/20 flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-sm">{res.slot}</span>
                    <p className="font-bold text-lg leading-relaxed">{res.question}</p>
                  </div>
                  <div className="p-6 grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <p className="text-[10px] uppercase font-black text-primary tracking-widest">Available Options</p>
                      <div className="space-y-2">
                        {(res.options || res.choices || []).map((choice, cidx) => {
                          const isChosen = choice === res.answer;
                          return (
                            <div key={cidx} className={`p-3 rounded-xl border text-sm transition-all ${
                              isChosen ? "bg-primary/20 border-primary font-bold shadow-sm scale-[1.01]" : "bg-card/50 border-border-custom opacity-70"
                            }`}>
                              <span className="opacity-50 mr-2">{String.fromCharCode(65 + cidx)}.</span> {choice}
                              {isChosen && <span className="ml-2 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">Selected</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-4 bg-primary/5 p-5 rounded-2xl border border-primary/10">
                      <div>
                        <p className="text-[10px] uppercase font-black text-primary tracking-widest mb-1">AI Reasoning</p>
                        <p className="text-sm leading-relaxed italic text-foreground/90 font-medium">&quot;{res.reasoning}&quot;</p>
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                         <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                           res.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-orange-500/20 text-orange-500'
                         }`}>Confidence: {res.confidence}</span>
                         <span className="text-[10px] font-mono opacity-40">AUTO-SAVED</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}