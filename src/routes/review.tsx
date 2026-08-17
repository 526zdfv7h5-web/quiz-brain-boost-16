import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, XCircle } from "lucide-react";
import { loadQuiz, type QuizState } from "@/lib/quiz";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review answers — Brain Train AI" },
      {
        name: "description",
        content:
          "Go through every question with your answer, the correct answer, an explanation and the PDF section it came from.",
      },
      { property: "og:title", content: "Review answers — Brain Train AI" },
      {
        property: "og:description",
        content: "Detailed answer review for your Brain Train AI session.",
      },
    ],
  }),
  component: ReviewPage,
});

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function ReviewPage() {
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
        <h1 className="text-xl font-bold">Nothing to review</h1>
        <Link
          to="/"
          className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Start a session
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 pb-[max(4rem,env(safe-area-inset-bottom))] pt-10">
      <Link to="/results" className="flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to results
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Review answers</h1>
      <p className="mt-2 truncate text-sm text-muted-foreground">
        {quiz.config.fileName} · {quiz.questions.length} questions
      </p>

      <div className="mt-7 flex flex-col gap-4">
        {quiz.questions.map((q, i) => {
          if (q.type === "mcq") {
            const given = quiz.answers[i];
            const answered = given !== null && given !== undefined;
            const isCorrect = answered && given === q.correctIndex;
            return (
              <article key={q.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Question {i + 1}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      isCorrect
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {isCorrect ? "Correct" : answered ? "Wrong" : "Not answered"}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-bold leading-snug">{q.prompt}</h2>

                <div className="mt-4 space-y-2">
                  <div
                    className={`rounded-2xl border p-3 text-sm ${
                      isCorrect
                        ? "border-primary/40 bg-primary/5"
                        : "border-destructive/40 bg-destructive/5"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Your answer
                    </p>
                    <p className="mt-1 leading-relaxed">
                      {answered ? `${LETTERS[given]}. ${q.options[given]}` : "Not answered"}
                    </p>
                  </div>
                  {!isCorrect && (
                    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Correct answer
                      </p>
                      <p className="mt-1 leading-relaxed">
                        {LETTERS[q.correctIndex]}. {q.options[q.correctIndex]}
                      </p>
                    </div>
                  )}
                </div>

                {q.explanation && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {q.explanation}
                  </p>
                )}
                {q.sourceRef && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> {q.sourceRef}
                  </p>
                )}
              </article>
            );
          }

          const text = (quiz.textAnswers[i] ?? "").trim();
          const grade = quiz.grades[i];
          return (
            <article key={q.id} className="rounded-3xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Question {i + 1} · Theory
                </span>
                {grade && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      grade.score >= 5
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {grade.score}/10
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-base font-bold leading-snug">{q.prompt}</h2>

              <div className="mt-4 rounded-2xl border border-border p-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Your answer
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {text || "Not answered"}
                </p>
              </div>

              {grade && grade.missingPoints.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Missing points
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {grade.missingPoints.map((p, k) => (
                      <li key={k}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {grade?.feedback && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {grade.feedback}
                </p>
              )}

              <div className="mt-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Model answer
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{q.modelAnswer}</p>
              </div>

              {q.sourceRef && (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> {q.sourceRef}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <Link
        to="/results"
        className="mt-8 block rounded-2xl bg-primary px-6 py-4 text-center text-base font-semibold text-primary-foreground shadow-soft"
      >
        Back to results
      </Link>
    </main>
  );
}
