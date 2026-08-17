import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Timer } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { loadPdf, loadQuiz, saveQuiz, type QuizState } from "@/lib/quiz";
import { formatClock, useCountdown } from "@/lib/use-countdown";
import { gradeTheoryAnswers } from "@/lib/quiz.functions";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Your session — Brain Train AI" },
      {
        name: "description",
        content:
          "Answer questions generated only from your uploaded study material, with an optional countdown timer.",
      },
      { property: "og:title", content: "Your session — Brain Train AI" },
      {
        property: "og:description",
        content: "Quiz, theory and exam questions generated from your PDF notes.",
      },
    ],
  }),
  component: QuizPage,
});

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function QuizPage() {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const gradeFn = useServerFn(gradeTheoryAnswers);

  useEffect(() => {
    setQuiz(loadQuiz());
    setReady(true);
  }, []);

  const timer = useCountdown(quiz?.startedAt ?? null, quiz?.config.timeLimitMin ?? null);

  const submit = useCallback(
    async (state: QuizState) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setError(null);

      const theoryIdx = state.questions
        .map((q, i) => (q.type === "theory" ? i : -1))
        .filter((i) => i >= 0);

      let grades = state.grades;
      if (theoryIdx.length > 0) {
        setSubmitting(true);
        const pdf = loadPdf();
        try {
          if (!pdf) throw new Error("Your PDF is no longer available for grading.");
          const { grades: got } = await gradeFn({
            data: {
              pdfText: pdf.text,
              items: theoryIdx.map((i) => {
                const q = state.questions[i]!;
                return {
                  prompt: q.prompt,
                  modelAnswer: q.type === "theory" ? q.modelAnswer : "",
                  keyPoints: q.type === "theory" ? q.keyPoints : [],
                  answer: state.textAnswers[i] ?? "",
                };
              }),
            },
          });
          grades = [...state.grades];
          theoryIdx.forEach((qi, k) => {
            grades[qi] = got[k] ?? null;
          });
        } catch (e) {
          setError(
            e instanceof Error && e.message
              ? e.message
              : "Grading failed, showing your answers without scores.",
          );
        }
        setSubmitting(false);
      }

      const done: QuizState = {
        ...state,
        grades,
        endedAt: Date.now(),
        submitted: true,
      };
      saveQuiz(done);
      setQuiz(done);
      navigate({ to: "/results" });
    },
    [gradeFn, navigate],
  );

  useEffect(() => {
    if (quiz && timer.active && timer.expired && !quiz.submitted) {
      void submit(quiz);
    }
  }, [quiz, timer.active, timer.expired, submit]);

  if (!ready) return null;

  if (!quiz) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold">No session yet</h1>
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

  const q = quiz.questions[index]!;
  const isLast = index === quiz.questions.length - 1;
  const answered =
    q.type === "mcq"
      ? quiz.answers[index] !== null && quiz.answers[index] !== undefined
      : (quiz.textAnswers[index] ?? "").trim().length > 0;

  function update(patch: Partial<QuizState>) {
    if (!quiz) return;
    const next = { ...quiz, ...patch };
    setQuiz(next);
    saveQuiz(next);
  }

  function choose(i: number) {
    if (!quiz) return;
    const answers = [...quiz.answers];
    answers[index] = i;
    update({ answers });
  }

  function type(text: string) {
    if (!quiz) return;
    const textAnswers = [...quiz.textAnswers];
    textAnswers[index] = text;
    update({ textAnswers });
  }

  const progress = ((index + 1) / quiz.questions.length) * 100;
  const remaining = timer.active ? timer.remainingMs ?? 0 : 0;
  const warn = timer.active && remaining <= 5 * 60_000;
  const critical = timer.active && remaining <= 60_000;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
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
            {quiz.mode} · Question {index + 1} of {quiz.questions.length}
          </p>
        </div>
      </header>

      {timer.active && (
        <div
          className={`mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 ${
            critical
              ? "border-destructive bg-destructive/10 text-destructive"
              : warn
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card"
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4" /> Time remaining
          </span>
          <span className="font-mono text-base font-bold tabular-nums">
            {formatClock(remaining)}
          </span>
        </div>
      )}

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h1 className="mt-7 text-xl font-bold leading-snug">{q.prompt}</h1>

      {q.type === "mcq" ? (
        <div className="mt-6 flex flex-col gap-3">
          {q.options.map((opt, i) => {
            const active = quiz.answers[index] === i;
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
      ) : (
        <textarea
          value={quiz.textAnswers[index] ?? ""}
          onChange={(e) => type(e.target.value)}
          rows={8}
          placeholder="Write your answer here…"
          className="mt-6 w-full rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed outline-none focus:border-primary"
        />
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <button
          type="button"
          onClick={() => {
            if (isLast) void submit(quiz);
            else setIndex((i) => i + 1);
          }}
          disabled={submitting || (!isLast && false)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Grading your answers…
            </>
          ) : (
            <>
              {isLast ? "Submit" : "Next question"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        {!isLast && !answered && (
          <p className="text-center text-xs text-muted-foreground">
            You can skip and come back to this question.
          </p>
        )}
      </div>
    </main>
  );
}
