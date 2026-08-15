export type Difficulty = "easy" | "medium" | "hard";

export type Question = {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
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

const SAMPLE_TOPICS = [
  "the central idea introduced in the opening section",
  "the primary function described in the diagram",
  "the term used for the process of energy transfer",
  "the main conclusion of the case study",
  "the relationship between the two variables discussed",
  "the exception noted by the author",
  "the correct order of the described steps",
  "the definition given for the key concept",
];

export function buildPlaceholderQuiz(config: QuizConfig): QuizState {
  const questions: Question[] = Array.from({ length: config.count }, (_, i) => ({
    id: i + 1,
    prompt: `Based on your notes, which statement best describes ${
      SAMPLE_TOPICS[i % SAMPLE_TOPICS.length]
    }?`,
    options: [
      "It defines the core principle covered in the material.",
      "It applies only to unrelated edge cases.",
      "It contradicts the summary given in the notes.",
      "It was mentioned only as historical background.",
    ],
    correctIndex: i % 4 === 0 ? 0 : 0,
  }));

  return { config, questions, answers: Array(config.count).fill(null) };
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
