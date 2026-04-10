// hooks/useQuizzes.js
import { useState, useEffect, useCallback } from "react";

export function useQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await window.fetch("/api/quizzes");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Ensure we handle the data correctly (it's an array directly from the API now)
      setQuizzes(Array.isArray(data) ? data : (data.quizzes || []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { quizzes, loading, error, refetch: fetch };
}