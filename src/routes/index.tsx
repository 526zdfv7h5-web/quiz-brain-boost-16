import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  GraduationCap,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  buildQuizState,
  MIN_PDF_CHARS,
  saveQuiz,
  type Difficulty,
} from "@/lib/quiz";
import { generateQuestions } from "@/lib/quiz.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brain Train AI — Turn PDFs into practice quizzes" },
      {
        name: "description",
        content:
          "Upload lecture notes or textbook PDFs and instantly generate multiple-choice practice quizzes with instant scoring.",
      },
      { property: "og:title", content: "Brain Train AI — Turn PDFs into practice quizzes" },
      {
        property: "og:description",
        content:
          "Upload a PDF, pick a difficulty and question count, and study with auto-generated multiple-choice quizzes.",
      },
    ],
  }),
  component: Home,
});

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Recall" },
  { value: "medium", label: "Medium", hint: "Applied" },
  { value: "hard", label: "Hard", hint: "Analysis" },
];

const COUNTS = [5, 10, 20, 30];

function Home() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(10);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generateFn = useServerFn(generateQuestions);
  const busy = status !== null;

  function pick(f: File | undefined | null) {
    setError(null);
    if (f && f.type === "application/pdf") setFile(f);
    else if (f) setError("That file isn't a PDF. Please upload a PDF document.");
  }

  async function generate() {
    if (!file || busy) return;
    setError(null);
    try {
      setStatus("Reading your PDF…");
      const { extractPdfText } = await import("@/lib/pdf-text");
      const { text } = await extractPdfText(file);

      if (text.replace(/\s/g, "").length < MIN_PDF_CHARS) {
        setStatus(null);
        setError(
          "We couldn't extract enough readable text from this PDF. It may be a scanned image or empty. Try a text-based PDF.",
        );
        return;
      }

      setStatus("Generating questions from your PDF…");
      const { questions } = await generateFn({
        data: { pdfText: text, difficulty, count },
      });

      saveQuiz(buildQuizState({ fileName: file.name, difficulty, count }, questions));
      setStatus(null);
      navigate({ to: "/quiz" });
    } catch (e) {
      setStatus(null);
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Something went wrong while reading your PDF. Please try again.",
      );
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 pb-16 pt-10">
      <header className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight">Brain Train AI</p>
          <p className="truncate text-xs text-muted-foreground">
            Study smarter from your own notes
          </p>
        </div>
      </header>

      <section className="mt-8">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
          Turn any PDF into a<span className="text-primary"> practice quiz</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Upload lecture notes, a textbook chapter or a handout. Choose how hard and
          how many questions — then test yourself.
        </p>
      </section>

      <section className="mt-7">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/60 hover:bg-primary/5"
            }`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </span>
            <span className="text-base font-semibold">Upload your PDF</span>
            <span className="text-xs text-muted-foreground">
              Tap to browse or drop a file here · PDF only
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {file.size > 1024 * 1024
                  ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(file.size / 1024))} KB`}{" "}
                · ready
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove file"
              onClick={() => setFile(null)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Difficulty</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDifficulty(d.value)}
              className={`rounded-2xl border px-2 py-3 text-center transition-colors ${
                difficulty === d.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="block text-sm font-semibold">{d.label}</span>
              <span
                className={`block text-[11px] ${
                  difficulty === d.value
                    ? "text-primary-foreground/75"
                    : "text-muted-foreground"
                }`}
              >
                {d.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Number of questions</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {COUNTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCount(c)}
              className={`rounded-2xl border py-3 text-sm font-semibold transition-colors ${
                count === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 text-sm leading-relaxed text-destructive">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!file || busy}
        onClick={generate}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft transition-opacity disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {busy ? status : "Generate Quiz"}
      </button>
      {!file && !busy && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Questions are built only from the PDF you upload
        </p>
      )}
    </main>
  );
}
