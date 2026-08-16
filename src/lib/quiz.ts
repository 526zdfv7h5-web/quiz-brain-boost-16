export type Difficulty = "easy" | "medium" | "hard";
export type Mode = "study" | "quiz" | "theory" | "exam";
export type QuestionType = "mcq" | "theory" | "mixed";

export type McqQuestion = {
  id: number;
  type: "mcq";
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Reference to the PDF section/page supporting this question. */
  sourceRef: string;
};

export type TheoryQuestion = {
  id: number;
  type: "theory";
  prompt: string;
  modelAnswer: string;
  keyPoints: string[];
  sourceRef: string;
};

export type Question = McqQuestion | TheoryQuestion;

export type TheoryGrade = {
  score: number;
  correctPoints: string[];
  missingPoints: string[];
  feedback: string;
};

export type QuizConfig = {
  fileName: string;
  difficulty: Difficulty;
  count: number;
  timeLimitMin: number | null;
  questionType: QuestionType;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
};

export type QuizState = {
  mode: Mode;
  config: QuizConfig;
  questions: Question[];
  /** Selected option index per question (MCQ only). */
  answers: (number | null)[];
  /** Typed answer per question (theory only). */
  textAnswers: (string | null)[];
  /** AI grade per question (theory only). */
  grades: (TheoryGrade | null)[];
  startedAt: number;
  endedAt: number | null;
  submitted: boolean;
};

const KEY = "brain-train-quiz";
const PDF_KEY = "brain-train-pdf";

export const MIN_PDF_CHARS = 400;

export const TIME_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "No limit" },
  { value: 10, label: "10 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
];

export const EXAM_TIME_OPTIONS: { value: number | null; label: string }[] = [
  { value: 10, label: "10 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

export type RawMcq = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  sourceRef?: string;
};

export type RawTheory = {
  prompt: string;
  modelAnswer: string;
  keyPoints?: string[];
  sourceRef?: string;
};

function dedupe<T extends { prompt: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((q) => {
    const key = q.prompt.trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toMcq(raw: RawMcq[], randomizeOptions: boolean): Omit<McqQuestion, "id">[] {
  return dedupe(raw).map((q) => {
    let options = q.options;
    let correctIndex = q.correctIndex;
    if (randomizeOptions) {
      const correct = q.options[q.correctIndex];
      options = shuffle(q.options);
      correctIndex = Math.max(0, options.findIndex((o) => o === correct));
    }
    return {
      type: "mcq" as const,
      prompt: q.prompt,
      options,
      correctIndex,
      explanation: q.explanation ?? "",
      sourceRef: q.sourceRef ?? "",
    };
  });
}

export function toTheory(raw: RawTheory[]): Omit<TheoryQuestion, "id">[] {
  return dedupe(raw).map((q) => ({
    type: "theory" as const,
    prompt: q.prompt,
    modelAnswer: q.modelAnswer,
    keyPoints: q.keyPoints ?? [],
    sourceRef: q.sourceRef ?? "",
  }));
}

export function buildSession(
  mode: Mode,
  config: QuizConfig,
  parts: Omit<Question, "id">[],
): QuizState {
  const ordered = config.randomizeQuestions ? shuffle(parts) : parts;
  const questions = ordered.map((q, i) => ({ ...q, id: i + 1 }) as Question);
  return {
    mode,
    config,
    questions,
    answers: Array(questions.length).fill(null),
    textAnswers: Array(questions.length).fill(null),
    grades: Array(questions.length).fill(null),
    startedAt: Date.now(),
    endedAt: null,
    submitted: false,
  };
}

export type Score = {
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  points: number;
  maxPoints: number;
  pct: number;
};

export function scoreSession(s: QuizState): Score {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  let points = 0;
  const total = s.questions.length;

  s.questions.forEach((q, i) => {
    if (q.type === "mcq") {
      const a = s.answers[i];
      if (a === null || a === undefined) {
        unanswered += 1;
      } else if (a === q.correctIndex) {
        correct += 1;
        points += 1;
      } else {
        wrong += 1;
      }
    } else {
      const text = (s.textAnswers[i] ?? "").trim();
      const grade = s.grades[i];
      if (!text) {
        unanswered += 1;
      } else if (grade && grade.score >= 5) {
        correct += 1;
      } else {
        wrong += 1;
      }
      points += grade ? grade.score / 10 : 0;
    }
  });

  const maxPoints = total;
  const pct = total === 0 ? 0 : Math.round((points / maxPoints) * 100);
  return { total, correct, wrong, unanswered, points, maxPoints, pct };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function saveQuiz(state: QuizState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(state));
}

export function loadQuiz(): QuizState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuizState;
    if (!parsed || !Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearQuiz() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}

export function savePdf(fileName: string, text: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PDF_KEY, JSON.stringify({ fileName, text }));
  } catch {
    /* storage full — quiz still works for this session */
  }
}

export function loadPdf(): { fileName: string; text: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PDF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { fileName: string; text: string };
  } catch {
    return null;
  }
}

export function clearPdf() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PDF_KEY);
}
