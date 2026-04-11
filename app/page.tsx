"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/user-info");
        setIsLoggedIn(res.ok);
      } catch {
        setIsLoggedIn(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden px-6 py-8 sm:px-10">
      <div className="pointer-events-none absolute left-0 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-yellow-300/20 blur-3xl" />

      <section className="z-10 mx-auto flex w-full max-w-6xl flex-col">
        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold tracking-[0.18em] text-text-muted">AI MOODLE QUIZ AUTOMATER</p>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-[var(--accent-foreground)] transition hover:opacity-90"
            >
              {isLoggedIn ? "Dashboard" : "Login"}
            </Link>
          </div>
        </header>

        <h1 className="max-w-4xl text-3xl font-bold leading-tight sm:text-5xl">
          Solve smarter. Schedule faster. Learn better.
        </h1>

        <p className="mt-6 max-w-3xl text-lg text-text-muted">
          This project automates Moodle quiz workflows with AI-powered solving, scheduled quiz runs,
          and dashboard-level monitoring so you can spend less time clicking and more time learning.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-border-custom bg-secondary p-5">
            <p className="text-2xl font-bold text-primary">Smart Solver</p>
            <p className="mt-2 text-sm text-text-muted">AI-assisted answers with rapid question understanding.</p>
          </article>
          <article className="rounded-2xl border border-border-custom bg-secondary p-5">
            <p className="text-2xl font-bold text-primary">Auto Scheduler</p>
            <p className="mt-2 text-sm text-text-muted">Plan quiz attempts and let automation handle timing.</p>
          </article>
          <article className="rounded-2xl border border-border-custom bg-secondary p-5">
            <p className="text-2xl font-bold text-primary">Live Insights</p>
            <p className="mt-2 text-sm text-text-muted">Track status, progress, and performance in one dashboard.</p>
          </article>
        </div>

        <p className="mt-10 text-sm text-text-muted">Secure access to your personalized automation dashboard.</p>
      </section>
    </main>
  );
}
