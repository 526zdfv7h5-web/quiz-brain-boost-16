export type Difficulty = "easy" | "medium" | "hard";

export type Question = {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  /** Hidden reference to the PDF section/page supporting this question. */
  sourceRef: string;
};

export type QuizConfig = {
  fileName: string;
  difficulty: Difficulty;
  count: number;
};

export type QuizState = {
  config: QuizConfig;
  questions: Question[];
  answers: (number | null)[];
};

const KEY = "brain-train-quiz";

export const MIN_PDF_CHARS = 400;

export function buildQuizState(
  config: QuizConfig,
  raw: { prompt: string; options: string[]; correctIndex: number; sourceRef?: string }[],
): QuizState {
  const questions: Question[] = raw.map((q, i) => ({
    id: i + 1,
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correctIndex,
    sourceRef: q.sourceRef ?? "",
  }));
  return { config, questions, answers: Array(questions.length).fill(null) };
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
    return JSON.parse(raw) as QuizState;
  } catch {
    return null;
  }
}

export function clearQuiz() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
