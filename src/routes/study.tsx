import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, FileText, XCircle } from "lucide-react";
import { loadQuiz, saveQuiz, type QuizState } from "@/lib/quiz";

export const Route = createFileRoute("/study")({
  head: () => ({
    meta: [
      { title: "Study Mode — Brain Train AI" },
      {
        name: "description",
        content:
          "Practise one question at a time with instant feedback, explanations and PDF sources from your own notes.",
      },
      { property: "og:title", content: "Study Mode — Brain Train AI" },
      {
        property: "og:description",
        content: "Instant-feedback practice questions generated from your uploaded PDF.",
      },
    ],
  }),
  component: StudyPage,
});

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function StudyPage() {
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuiz(loadQuiz());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!quiz) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold">No study session yet</h1>
        <Link
          to="/"
          className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Go to upload
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BookOpen className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Session complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You worked through all {quiz.questions.length} questions from {quiz.config.fileName}.
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setPicked(null);
            setChecked(false);
            setDone(false);
          }}
          className="mt-8 w-full rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft"
        >
          Restart session
        </button>
        <Link
          to="/"
          className="mt-3 w-full rounded-2xl border border-border px-6 py-4 text-base font-semibold"
        >
          Pick another mode
        </Link>
      </main>
    );
  }

  const q = quiz.questions[index]!;
  if (q.type !== "mcq") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          Study Mode only supports multiple-choice questions.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Back to modes
        </Link>
      </main>
    );
  }

  const isLast = index === quiz.questions.length - 1;
  const correct = picked === q.correctIndex;
  const progress = ((index + 1) / quiz.questions.length) * 100;

  function check() {
    if (picked === null || !quiz) return;
    const answers = [...quiz.answers];
    answers[index] = picked;
    const next = { ...quiz, answers };
    setQuiz(next);
    saveQuiz(next);
    setChecked(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
      <header className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{quiz.config.fileName}</p>
        <p className="text-sm font-semibold">
          Study Mode · Question {index + 1} of {quiz.questions.length}
        </p>
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
          const isCorrect = i === q.correctIndex;
          const isPicked = picked === i;
          let cls = "border-border bg-card hover:border-primary/40";
          if (checked && isCorrect) cls = "border-primary bg-primary/10";
          else if (checked && isPicked) cls = "border-destructive bg-destructive/10";
          else if (!checked && isPicked) cls = "border-primary bg-primary/5";
          return (
            <button
              key={i}
              type="button"
              disabled={checked}
              onClick={() => setPicked(i)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${cls}`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  isPicked || (checked && isCorrect)
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

      {checked && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <p
            className={`flex items-center gap-2 text-sm font-semibold ${
              correct ? "text-primary" : "text-destructive"
            }`}
          >
            {correct ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Correct
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" /> Not quite
              </>
            )}
          </p>
          {!correct && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Correct answer: </span>
              <span className="font-medium">{q.options[q.correctIndex]}</span>
            </p>
          )}
          {q.explanation && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{q.explanation}</p>
          )}
          {q.sourceRef && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> {q.sourceRef}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto pt-8">
        {!checked ? (
          <button
            type="button"
            onClick={check}
            disabled={picked === null}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft disabled:opacity-40"
          >
            Check answer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                setDone(true);
              } else {
                setIndex((i) => i + 1);
                setPicked(null);
                setChecked(false);
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft"
          >
            {isLast ? "Finish session" : "Next question"}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </main>
  );
}
