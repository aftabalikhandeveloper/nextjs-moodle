"use client";
import { useState } from "react";
import QuizCard from "./QuizCard";

export default function QuizList({ quizzes }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = quizzes
    .filter(q => {
      if (filter === "all") return true;
      return q.status === filter;
    })
    .filter(q => !search || q.name?.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { id: "all", label: "All Items" },
    { id: "current", label: "Active" },
    { id: "upcoming", label: "Upcoming" },
    { id: "past", label: "Completed" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div className="flex bg-secondary p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === tab.id 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            placeholder="Filter by quiz name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-secondary border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-secondary/50 rounded-3xl py-20 text-center border-2 border-dashed border-border-custom">
           <div className="text-4xl mb-4">??</div>
           <h3 className="font-bold text-lg">No results found</h3>
           <p className="text-text-muted">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(q => <QuizCard key={q.id} quiz={q} />)}
        </div>
      )}
    </div>
  );
}
