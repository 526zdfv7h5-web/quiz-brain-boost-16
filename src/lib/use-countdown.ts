import { useEffect, useState } from "react";

/**
 * Countdown based on the session's own start timestamp, so refreshing
 * the page never resets a student's remaining time.
 */
export function useCountdown(startedAt: number | null, limitMinutes: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || !limitMinutes) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, limitMinutes]);

  if (!startedAt || !limitMinutes) return { active: false as const, remainingMs: null, expired: false };

  const endsAt = startedAt + limitMinutes * 60_000;
  const remainingMs = Math.max(0, endsAt - now);
  return { active: true as const, remainingMs, expired: remainingMs <= 0 };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
