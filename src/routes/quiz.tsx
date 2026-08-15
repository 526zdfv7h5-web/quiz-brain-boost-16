import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { loadQuiz, saveQuiz, type QuizState } from "@/lib/quiz";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Your quiz — Brain Train AI" },
      {
        name: "description",
        content:
          "Answer auto-generated multiple-choice questions built from your uploaded study material.",
      },
      { property: "og:title", content: "Your quiz — Brain Train AI" },
      {
        property: "og:description",
        content: "Multiple-choice practice questions generated from your PDF notes.",
      },
    ],
  }),
  component: QuizPage,
});

const LETTERS = ["A", "B", "C", "D"];

function QuizPage() {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuiz(loadQuiz());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!quiz) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold">No quiz yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a PDF to generate your questions.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Go to upload
        </Link>
      </main>
    );
  }

  const q = quiz.questions[index];
  const selected = quiz.answers[index];
  const isLast = index === quiz.questions.length - 1;

  function choose(i: number) {
    if (!quiz) return;
    const answers = [...quiz.answers];
    answers[index] = i;
    const next = { ...quiz, answers };
    setQuiz(next);
    saveQuiz(next);
  }

  function next() {
    if (isLast) {
      navigate({ to: "/results" });
    } else {
      setIndex((i) => i + 1);
    }
  }

  const progress = ((index + 1) / quiz.questions.length) * 100;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-8 pt-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <button
          type="button"
          aria-label="Previous question"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-foreground disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{quiz.config.fileName}</p>
          <p className="text-sm font-semibold capitalize">
            {quiz.config.difficulty} · Question {index + 1} of {quiz.questions.length}
          </p>
        </div>
      </header>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h1 className="mt-7 text-xl font-bold leading-snug">{q.prompt}</h1>

      <div className="mt-6 flex flex-col gap-3">
        {q.options.map((opt, i) => {
          const active = selected === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0 text-sm leading-relaxed">{opt}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={next}
          disabled={selected === null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft disabled:opacity-40"
        >
          {isLast ? "Finish quiz" : "Next question"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}
