"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/user-info");
        if (res.ok) {
          router.replace("/dashboard");
        }
      } catch {
      }
    };

    checkAuth();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        router.push("/dashboard");
      } else {
        setError(data.message || "Invalid login");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <header className="mx-auto mb-10 flex w-full max-w-6xl items-center justify-between">
        <p className="text-sm font-semibold tracking-[0.18em] text-text-muted">AI MOODLE QUIZ AUTOMATER</p>
        <ThemeToggle />
      </header>

      <div className="mx-auto w-full max-w-md bg-card border border-border-custom rounded-3xl p-8 shadow-2xl animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-primary mb-2">Secure Login</h1>
          <p className="text-text-muted text-sm font-medium">Enter your AI platform credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-primary tracking-widest px-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-secondary/50 border border-border-custom rounded-2xl p-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:opacity-30"
              placeholder="admin"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-primary tracking-widest px-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-secondary/50 border border-border-custom rounded-2xl p-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:opacity-30"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center animate-pulse">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Login to Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
