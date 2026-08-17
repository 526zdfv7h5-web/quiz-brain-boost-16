import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Clock, XCircle } from "lucide-react";
import {
  clearQuiz,
  formatDuration,
  loadQuiz,
  saveQuiz,
  scoreSession,
  type QuizState,
} from "@/lib/quiz";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — Brain Train AI" },
      {
        name: "description",
        content:
          "See your score, percentage, correct, wrong and unanswered questions plus a full answer review.",
      },
      { property: "og:title", content: "Results — Brain Train AI" },
      {
        property: "og:description",
        content: "Your score breakdown for the session generated from your PDF.",
      },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuiz(loadQuiz());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!quiz) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold">No results yet</h1>
        <Link
          to="/"
          className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Start a quiz
        </Link>
      </main>
    );
  }

  const score = scoreSession(quiz);
  const timeUsed = (quiz.endedAt ?? Date.now()) - quiz.startedAt;
  const message =
    score.pct >= 80 ? "Excellent work" : score.pct >= 50 ? "Solid effort" : "Keep training";
  const summary =
    score.pct >= 80
      ? "You have a strong grasp of this material — review the few misses and move on."
      : score.pct >= 50
        ? "A good base. Focus your next session on the questions you missed."
        : "Re-read the sections listed in your review, then try the same questions again.";

  function tryAgain() {
    if (!quiz) return;
    const fresh: QuizState = {
      ...quiz,
      answers: Array(quiz.questions.length).fill(null),
      textAnswers: Array(quiz.questions.length).fill(null),
      grades: Array(quiz.questions.length).fill(null),
      startedAt: Date.now(),
      endedAt: null,
      submitted: false,
    };
    saveQuiz(fresh);
    navigate({ to: "/quiz" });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Results</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{message}</h1>
      <p className="mt-2 truncate text-sm capitalize text-muted-foreground">
        {quiz.config.fileName} · {quiz.mode} · {quiz.config.difficulty}
      </p>

      <div className="mt-7 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-6xl font-extrabold tracking-tight text-primary">{score.pct}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Score: {Math.round(score.points * 10) / 10} / {score.maxPoints}
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Time used {formatDuration(timeUsed)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Correct
          </span>
          <p className="mt-1 text-2xl font-bold">{score.correct}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <XCircle className="h-3.5 w-3.5 text-destructive" /> Wrong
          </span>
          <p className="mt-1 text-2xl font-bold">{score.wrong}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CircleDashed className="h-3.5 w-3.5" /> Skipped
          </span>
          <p className="mt-1 text-2xl font-bold">{score.unanswered}</p>
        </div>
      </div>

      <p className="mt-5 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        {summary}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/review"
          className="rounded-2xl bg-primary px-6 py-4 text-center text-base font-semibold text-primary-foreground shadow-soft"
        >
          Review answers
        </Link>
        <button
          type="button"
          onClick={tryAgain}
          className="rounded-2xl border border-border px-6 py-4 text-center text-base font-semibold"
        >
          Try again
        </button>
        <Link
          to="/"
          onClick={() => clearQuiz()}
          className="rounded-2xl border border-border px-6 py-4 text-center text-base font-semibold"
        >
          New session / new PDF
        </Link>
      </div>
    </main>
  );
}
