import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { clearQuiz, loadQuiz, type QuizState } from "@/lib/quiz";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Quiz results — Brain Train AI" },
      {
        name: "description",
        content:
          "See your score, correct and wrong answers, and percentage for the quiz generated from your notes.",
      },
      { property: "og:title", content: "Quiz results — Brain Train AI" },
      {
        property: "og:description",
        content: "Your score breakdown for the practice quiz generated from your PDF.",
      },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
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

  const total = quiz.questions.length;
  const correct = quiz.questions.reduce(
    (acc, q, i) => acc + (quiz.answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const wrong = total - correct;
  const pct = Math.round((correct / total) * 100);
  const message =
    pct >= 80 ? "Excellent work" : pct >= 50 ? "Solid effort" : "Keep training";

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 pb-16 pt-10">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Results</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{message}</h1>
      <p className="mt-2 truncate text-sm text-muted-foreground">
        {quiz.config.fileName} · {quiz.config.difficulty}
      </p>

      <div className="mt-7 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-6xl font-extrabold tracking-tight text-primary">{pct}%</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Score: {correct} / {total}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Correct
          </span>
          <p className="mt-1 text-2xl font-bold">{correct}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <XCircle className="h-4 w-4 text-destructive" /> Wrong
          </span>
          <p className="mt-1 text-2xl font-bold">{wrong}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/quiz"
          className="rounded-2xl bg-primary px-6 py-4 text-center text-base font-semibold text-primary-foreground shadow-soft"
        >
          Review answers
        </Link>
        <Link
          to="/"
          onClick={() => clearQuiz()}
          className="rounded-2xl border border-border px-6 py-4 text-center text-base font-semibold"
        >
          New quiz
        </Link>
      </div>
    </main>
  );
}
