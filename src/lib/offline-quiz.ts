/**
 * Offline (no-AI, no-credit) question generation and grading.
 *
 * Everything here is derived ONLY from the uploaded PDF text — the same
 * PDF-only rule the AI path follows. Used as a fallback when the AI
 * gateway is unavailable (no credits, rate limited, not configured).
 */

const STOP_WORDS = new Set(
  `the a an and or but if then than that this these those of in on at to for from by with without into over under between about as is are was were be been being it its their his her our your my we you they he she them us not no also such which who whom whose what when where why how can could should would may might must will shall do does did done have has had having more most some any each every other another same so very just only than too much many few both all any per via etc eg ie`.split(
    /\s+/,
  ),
);

type Sentence = { text: string; page: string };

function cleanWord(w: string) {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function isContentWord(w: string) {
  const c = cleanWord(w);
  return c.length >= 5 && !STOP_WORDS.has(c.toLowerCase()) && /\p{L}/u.test(c);
}

/** Split the document into usable sentences, tracking page markers. */
function splitSentences(pdfText: string): Sentence[] {
  const out: Sentence[] = [];
  let page = "";

  for (const block of pdfText.split(/\n(?=\[Page \d+\])/)) {
    const match = block.match(/^\[Page (\d+)\]/);
    if (match) page = `Page ${match[1]}`;
    const body = block.replace(/^\[Page \d+\]/, "").replace(/\s+/g, " ").trim();
    if (!body) continue;

    for (const raw of body.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)) {
      const text = raw.trim();
      const words = text.split(/\s+/);
      if (words.length < 8 || words.length > 45) continue;
      if (!/[a-z]/.test(text)) continue;
      out.push({ text, page });
    }
  }

  return out;
}

function pickTerm(sentence: string): string | null {
  const words = sentence.split(/\s+/).filter(isContentWord).map(cleanWord);
  if (words.length === 0) return null;
  // Prefer capitalized (non-sentence-initial) terms, otherwise the longest word.
  const capitalized = words.slice(1).filter((w) => /^[A-Z]/.test(w));
  const pool = capitalized.length > 0 ? capitalized : words;
  return pool.reduce((a, b) => (b.length > a.length ? b : a));
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]!);
}

export type OfflineMcq = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceRef: string;
};

export function buildOfflineMcqs(pdfText: string, count: number): OfflineMcq[] {
  const sentences = splitSentences(pdfText);
  if (sentences.length === 0) return [];

  const candidates: { sentence: Sentence; term: string }[] = [];
  const usedTerms = new Set<string>();

  for (const sentence of sentences) {
    const term = pickTerm(sentence.text);
    if (!term) continue;
    const key = term.toLowerCase();
    if (usedTerms.has(key)) continue;
    usedTerms.add(key);
    candidates.push({ sentence, term });
  }

  const terms = candidates.map((c) => c.term);
  const chosen = spread(candidates, count);

  return chosen.map(({ sentence, term }) => {
    const distractors = shuffled(
      terms.filter((t) => t.toLowerCase() !== term.toLowerCase()),
    ).slice(0, 3);

    while (distractors.length < 3) distractors.push(`None of the above`);

    const options = shuffled([term, ...distractors]);
    const blanked = sentence.text.replace(
      new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
      "______",
    );

    return {
      prompt: `According to the document, complete this statement: "${blanked}"`,
      options,
      correctIndex: options.indexOf(term),
      explanation: `The document states: "${sentence.text}"`,
      sourceRef: sentence.page,
    };
  });
}

export type OfflineTheory = {
  prompt: string;
  modelAnswer: string;
  keyPoints: string[];
  sourceRef: string;
};

export function buildOfflineTheory(
  pdfText: string,
  count: number,
): OfflineTheory[] {
  const sentences = splitSentences(pdfText);
  if (sentences.length === 0) return [];

  const candidates: { sentence: Sentence; term: string }[] = [];
  const used = new Set<string>();

  for (const sentence of sentences) {
    const term = pickTerm(sentence.text);
    if (!term) continue;
    const key = term.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    candidates.push({ sentence, term });
  }

  return spread(candidates, count).map(({ sentence, term }) => ({
    prompt: `Based on the document, explain what is stated about "${term}".`,
    modelAnswer: sentence.text,
    keyPoints: sentence.text
      .split(/\s+/)
      .filter(isContentWord)
      .map(cleanWord)
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, 6),
    sourceRef: sentence.page,
  }));
}

export type OfflineGrade = {
  score: number;
  correctPoints: string[];
  missingPoints: string[];
  feedback: string;
};

export function gradeOffline(item: {
  modelAnswer: string;
  keyPoints: string[];
  answer: string;
}): OfflineGrade {
  const answer = (item.answer ?? "").trim();

  if (!answer) {
    return {
      score: 0,
      correctPoints: [],
      missingPoints: item.keyPoints,
      feedback: "No answer was given.",
    };
  }

  const points =
    item.keyPoints.length > 0
      ? item.keyPoints
      : item.modelAnswer
          .split(/\s+/)
          .filter(isContentWord)
          .map(cleanWord)
          .slice(0, 6);

  const answerWords = new Set(
    answer.split(/\s+/).map((w) => cleanWord(w).toLowerCase()),
  );

  const correctPoints = points.filter((p) => {
    const lower = p.toLowerCase();
    if (answerWords.has(lower)) return true;
    // accept simple stem matches (plurals, verb endings)
    return [...answerWords].some(
      (w) =>
        w.length >= 4 &&
        (w.startsWith(lower.slice(0, Math.max(4, lower.length - 2))) ||
          lower.startsWith(w.slice(0, Math.max(4, w.length - 2)))),
    );
  });

  const missingPoints = points.filter((p) => !correctPoints.includes(p));
  const ratio = points.length === 0 ? 0 : correctPoints.length / points.length;
  const score = Math.round(ratio * 10);

  return {
    score,
    correctPoints,
    missingPoints,
    feedback:
      score >= 7
        ? "Your answer covers most of the points stated in the document."
        : score >= 4
          ? "Partly correct — some points from the document are missing."
          : "Your answer misses most of the points stated in the document.",
  };
}
