import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { generateTheoryQuestions } from "@/lib/quiz.functions";
import { loadPdf } from "@/lib/quiz";

export const Route = createFileRoute("/theory-generator")({
  component: TheoryGenerator,
});

function TheoryGenerator() {
  const navigate = useNavigate();
  const generate = useServerFn(generateTheoryQuestions);

  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<
    { prompt: string; sourceRef: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createQuestions() {
    const pdf = loadPdf();

    if (!pdf) {
      setError("Please upload a PDF first.");
      return;
    }

    setLoading(true);
    setError(null);
    setQuestions([]);

    try {
      const result = await generate({
        data: {
          pdfText: pdf.text,
          difficulty,
          count,
        },
      });

      setQuestions(
        result.questions.map((q) => ({
          prompt: q.prompt,
          sourceRef: q.sourceRef,
        })),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not generate theory questions.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 pb-16 pt-8">
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold">📖 Theory Generator</h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Generate theory questions from your uploaded PDF. No answers or
        grading required.
      </p>

      <section className="mt-7">
        <h2 className="text-sm font-semibold">Difficulty</h2>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold capitalize ${
                difficulty === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Number of questions</h2>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[5, 10, 20, 30].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                count === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={createQuestions}
        disabled={loading}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Generating…" : "Generate Theory Questions"}
      </button>

      {error && (
        <p className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {questions.length > 0 && (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-bold">
            Theory Questions
          </h2>

          {questions.map((q, i) => (
            <article
              key={i}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <p className="text-sm font-semibold leading-relaxed">
                {i + 1}. {q.prompt}
              </p>

              {q.sourceRef && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Source: {q.sourceRef}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
