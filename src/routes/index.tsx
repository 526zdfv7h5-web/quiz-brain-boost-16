import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  FileText,
  GraduationCap,
  Loader2,
  PenLine,
  Sparkles,
  Timer,
  Upload,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  buildSession,
  clearQuiz,
  EXAM_TIME_OPTIONS,
  MIN_PDF_CHARS,
  savePdf,
  saveQuiz,
  shuffle,
  TIME_OPTIONS,
  toMcq,
  toTheory,
  type Difficulty,
  type Mode,
  type Question,
  type QuestionType,
} from "@/lib/quiz";
import { generateQuestions, generateTheoryQuestions } from "@/lib/quiz.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brain Train AI — Turn PDFs into practice quizzes" },
      {
        name: "description",
        content:
          "Upload lecture notes or textbook PDFs and instantly generate study, quiz, theory and timed exam questions from your own material.",
      },
      { property: "og:title", content: "Brain Train AI — Turn PDFs into practice quizzes" },
      {
        property: "og:description",
        content:
          "Upload a PDF and study with auto-generated MCQs, written theory questions and timed exams built only from your notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
const EXAM_COUNTS = [10, 20, 30, 50];

const MODES: { value: Mode; emoji: string; label: string; blurb: string }[] = [
  { value: "study", emoji: "🧠", label: "Study Mode", blurb: "Answer & get instant feedback" },
  { value: "quiz", emoji: "📝", label: "Quiz Mode", blurb: "Classic MCQ quiz with scoring" },
  { value: "theory", emoji: "✍️", label: "Theory Mode", blurb: "Written answers, AI graded" },
  { value: "exam", emoji: "⏱️", label: "Timed Exam", blurb: "Full exam conditions" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function Home() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const extractionIdRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode>("quiz");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [count, setCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [examTime, setExamTime] = useState<number | null>(30);
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mcqFn = useServerFn(generateQuestions);
  const theoryFn = useServerFn(generateTheoryQuestions);
  const busy = status !== null;

  async function pick(f: File | undefined | null) {
    const extractionId = ++extractionIdRef.current;
    setError(null);
    setFile(null);
    setPdfText(null);
    setStatus(null);
    if (!f) return;

    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("That file isn't a PDF. Please upload a PDF document.");
      return;
    }

    setFile(f);
    setStatus("Reading your PDF…");
    try {
      const { extractPdfText } = await import("@/lib/pdf-text");
      const extracted = await extractPdfText(f);
      if (extractionId !== extractionIdRef.current) return;
      if (typeof extracted.text !== "string" || extracted.text.trim().length === 0) {
        throw new Error("We couldn't find readable text in this PDF.");
      }
      if (extracted.text.replace(/\s/g, "").length < MIN_PDF_CHARS) {
        throw new Error(
          "We couldn't extract enough readable text from this PDF. It may be scanned, image-only, or too short.",
        );
      }
      setPdfText(extracted.text);
      savePdf(f.name, extracted.text);
      setStatus(null);
    } catch (extractionError) {
      if (extractionId !== extractionIdRef.current) return;
      setPdfText(null);
      setStatus(null);
      setError(
        extractionError instanceof Error && extractionError.message
          ? extractionError.message
          : "We couldn't read this PDF. Please try a text-based PDF.",
      );
    }
  }

  const isExam = mode === "exam";
  const activeCount = isExam ? count : count;
  const activeType: QuestionType = isExam ? questionType : mode === "theory" ? "theory" : "mcq";
  const activeTime = isExam ? examTime : mode === "study" ? null : timeLimit;

  async function generate() {
    if (!file || !pdfText || busy) return;
    setError(null);
    try {
      setStatus("Generating questions from your PDF…");
      const parts: Omit<Question, "id">[] = [];

      const mcqCount =
        activeType === "mcq" ? activeCount : activeType === "mixed" ? Math.ceil(activeCount / 2) : 0;
      const theoryCount = activeCount - mcqCount;

      if (mcqCount > 0) {
        const { questions } = await mcqFn({
          data: { pdfText, difficulty, count: mcqCount },
        });
        parts.push(...toMcq(questions, isExam ? randomizeOptions : true));
      }
      if (theoryCount > 0) {
        const { questions } = await theoryFn({
          data: { pdfText, difficulty, count: theoryCount },
        });
        parts.push(...toTheory(questions));
      }

      if (parts.length === 0) throw new Error("No questions could be built from this PDF.");

      clearQuiz();
      const session = buildSession(
        mode,
        {
          fileName: file.name,
          difficulty,
          count: activeCount,
          timeLimitMin: activeTime,
          questionType: activeType,
          randomizeQuestions: isExam ? randomizeQuestions : activeType === "mixed",
          randomizeOptions: isExam ? randomizeOptions : true,
        },
        activeType === "mixed" && !isExam ? shuffle(parts) : parts,
      );
      saveQuiz(session);
      setStatus(null);
      navigate({ to: mode === "study" ? "/study" : "/quiz" });
    } catch (e) {
      setStatus(null);
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Something went wrong while building your questions. Please try again.",
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
          Upload lecture notes, a textbook chapter or a handout. Pick a mode, then test
          yourself — every question comes only from your PDF.
        </p>
      </section>

      <section className="mt-7">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
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
              void pick(e.dataTransfer.files?.[0]);
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
                ·{" "}
                {status === "Reading your PDF…"
                  ? "extracting text…"
                  : pdfText
                    ? "ready"
                    : "unreadable"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove file"
              onClick={() => {
                extractionIdRef.current += 1;
                setFile(null);
                setPdfText(null);
                setStatus(null);
                setError(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {pdfText && (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-semibold">Choose a mode</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`rounded-2xl border p-3 text-left transition-colors ${
                    mode === m.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <span className="text-lg">{m.emoji}</span>
                  <span className="mt-1 block text-sm font-semibold">{m.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {m.blurb}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6">
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
              {(isExam ? EXAM_COUNTS : COUNTS).map((c) => (
                <Chip key={c} active={count === c} onClick={() => setCount(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </section>

          {isExam && (
            <>
              <section className="mt-6">
                <h2 className="text-sm font-semibold">Question type</h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["mcq", "theory", "mixed"] as QuestionType[]).map((t) => (
                    <Chip
                      key={t}
                      active={questionType === t}
                      onClick={() => setQuestionType(t)}
                    >
                      {t === "mcq" ? "MCQ" : t === "theory" ? "Theory" : "Mixed"}
                    </Chip>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <h2 className="text-sm font-semibold">Exam duration</h2>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {EXAM_TIME_OPTIONS.map((t) => (
                    <Chip
                      key={t.label}
                      active={examTime === t.value}
                      onClick={() => setExamTime(t.value)}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </section>

              <section className="mt-6 space-y-2">
                {[
                  {
                    label: "Randomize questions",
                    on: randomizeQuestions,
                    set: setRandomizeQuestions,
                  },
                  { label: "Randomize options", on: randomizeOptions, set: setRandomizeOptions },
                ].map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    onClick={() => row.set(!row.on)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <span className="text-sm font-medium">{row.label}</span>
                    <span
                      className={`grid h-6 w-11 place-items-center rounded-full px-1 text-[10px] font-bold transition-colors ${
                        row.on
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.on ? "ON" : "OFF"}
                    </span>
                  </button>
                ))}
              </section>
            </>
          )}

          {(mode === "quiz" || mode === "theory") && (
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Timer className="h-4 w-4" /> Timer (optional)
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {TIME_OPTIONS.map((t) => (
                  <Chip
                    key={t.label}
                    active={timeLimit === t.value}
                    onClick={() => setTimeLimit(t.value)}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 text-sm leading-relaxed text-destructive">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!file || !pdfText || busy}
        onClick={generate}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-soft transition-opacity disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "study" ? (
          <BookOpen className="h-4 w-4" />
        ) : mode === "theory" ? (
          <PenLine className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {busy
          ? status
          : mode === "study"
            ? "Start Study Mode"
            : mode === "theory"
              ? "Start Theory Mode"
              : mode === "exam"
                ? "Start Timed Exam"
                : "Generate Quiz"}
      </button>
      {!file && !busy && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Questions are built only from the PDF you upload
        </p>
      )}
    </main>
  );
}
