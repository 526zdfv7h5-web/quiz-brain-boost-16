import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  buildOfflineMcqs,
  buildOfflineTheory,
  gradeOffline,
} from "@/lib/offline-quiz";

const BaseInput = z.object({
  pdfText: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(50),
});

const McqSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().default(""),
  sourceRef: z.string().default(""),
});

const TheorySchema = z.object({
  prompt: z.string().min(1),
  modelAnswer: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).default([]),
  sourceRef: z.string().default(""),
});

const GradeSchema = z.object({
  score: z.number().min(0).max(10),
  correctPoints: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
  feedback: z.string().default(""),
});

const GradeInput = z.object({
  pdfText: z.string().min(1),
  items: z
    .array(
      z.object({
        prompt: z.string(),
        modelAnswer: z.string(),
        keyPoints: z.array(z.string()).default([]),
        answer: z.string(),
      }),
    )
    .min(1)
    .max(50),
});

const PDF_ONLY = [
  "The DOCUMENT provided by the user is the ONLY authoritative source of information.",
  "You must not use outside knowledge, memory, web search, textbooks, or general knowledge.",
  "Every question, option, answer, explanation and source reference must be directly supported by explicit text in the DOCUMENT.",
  "Never invent facts and never invent page numbers or section names that do not appear in the DOCUMENT.",
  "If the DOCUMENT does not contain enough information for the requested number of UNIQUE questions, do not invent questions.",
].join("\n");

const DIFFICULTY_HINT = {
  easy: "Easy: direct recall of explicitly stated facts.",
  medium: "Medium: applying, connecting, or comparing stated facts within the document.",
  hard: "Hard: multi-step reasoning, comparison, analysis, or interpretation using only information stated in the document.",
} as const;

async function callAi(system: string, user: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];

  if (!apiKey) {
    throw new Error("AI is not configured for this project.");
  }

  const res = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
  );

  if (res.status === 429) {
    throw new Error(
      "AI rate limit reached. Please try again shortly.",
    );
  }

  if (res.status === 402) {
    throw new Error(
      "AI credits exhausted. Add credits to continue generating quizzes.",
    );
  }

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status}).`);
  }

  const payload = (await res.json()) as {
    choices?: {
      message?: {
        content?: string;
      };
    }[];
  };

  const content = payload.choices?.[0]?.message?.content ?? "";

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error(
      "The AI response could not be read. Please try again.",
    );
  }
}

/**
 * Normalize question text so duplicate questions can be detected.
 */
function normalizeQuestion(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "");
}

/**
 * Remove duplicate MCQs.
 */
function dedupeMcqs(items: z.infer<typeof McqSchema>[]) {
  const seen = new Set<string>();

  return items.filter((question) => {
    const key = normalizeQuestion(question.prompt);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Remove duplicate theory questions.
 */
function dedupeTheory(items: z.infer<typeof TheorySchema>[]) {
  const seen = new Set<string>();

  return items.filter((question) => {
    const key = normalizeQuestion(question.prompt);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Generate MCQs.
 *
 * The generator first requests the exact number.
 * If the AI returns fewer questions, it makes additional
 * requests for the missing questions.
 */
export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BaseInput.parse(input))
  .handler(async ({ data }) => {
    const system = [
      "You are a multiple-choice quiz generator for students.",
      PDF_ONLY,
      `The student requested EXACTLY ${data.count} questions.`,
      `You must attempt to return EXACTLY ${data.count} UNIQUE questions.`,
      "Do not intentionally return fewer questions.",
      "Each question must have exactly 4 options and exactly one correct answer.",
      "Distractors must be plausible and drawn from the DOCUMENT's own terminology.",
      "Do not use nonsense distractors.",
      "Do not repeat or paraphrase the same question twice.",
      "Vary which option position contains the correct answer.",
      "Include a short explanation of why the correct answer is correct.",
      "The explanation must be based only on the DOCUMENT.",
      "Include a sourceRef naming the page and/or section when the DOCUMENT provides it.",
      "Never invent page numbers.",
      'Respond with JSON only: {"questions":[{"prompt":string,"options":[string,string,string,string],"correctIndex":0-3,"explanation":string,"sourceRef":string}]}',
    ].join("\n");

    const allQuestions: z.infer<typeof McqSchema>[] = [];

    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remaining = data.count - allQuestions.length;

      if (remaining <= 0) break;

      const existingQuestions = allQuestions
        .map((q) => q.prompt)
        .join("\n");

      const parsed = await callAi(
        system,
        `
Generate EXACTLY ${remaining} NEW multiple-choice questions.

Difficulty:
${data.difficulty}. ${DIFFICULTY_HINT[data.difficulty]}

Already generated questions:
${existingQuestions || "(none)"}

IMPORTANT:
- Do NOT repeat any existing question.
- Do NOT paraphrase an existing question.
- Generate only questions supported by the DOCUMENT.
- Return exactly ${remaining} questions if the DOCUMENT contains enough supported information.

DOCUMENT START
${data.pdfText.slice(0, 120000)}
DOCUMENT END
`,
      );

      const result = z
        .object({
          questions: z.array(McqSchema),
        })
        .safeParse(parsed);

      if (!result.success) {
        if (attempt === maxAttempts - 1) {
          throw new Error(
            "The AI response could not be read. Please try again.",
          );
        }

        continue;
      }

      const newQuestions = dedupeMcqs(result.data.questions);

      for (const question of newQuestions) {
        if (allQuestions.length >= data.count) break;

        const duplicate = allQuestions.some(
          (existing) =>
            normalizeQuestion(existing.prompt) ===
            normalizeQuestion(question.prompt),
        );

        if (!duplicate) {
          allQuestions.push(question);
        }
      }
      }
    } catch {
      // AI unavailable (no credits, rate limit, not configured):
      // fall back to the offline PDF-only generator below.
    }

    if (allQuestions.length < data.count) {
      const offline = buildOfflineMcqs(
        data.pdfText,
        data.count - allQuestions.length,
      );

      for (const question of offline) {
        if (allQuestions.length >= data.count) break;

        const duplicate = allQuestions.some(
          (existing) =>
            normalizeQuestion(existing.prompt) ===
            normalizeQuestion(question.prompt),
        );

        if (!duplicate) {
          allQuestions.push(question);
        }
      }
    }

    if (allQuestions.length === 0) {
      throw new Error(
        "This PDF does not contain enough readable content to build questions from.",
      );
    }

    return {
      questions: allQuestions.slice(0, data.count),
    };
  });

/**
 * Generate Theory Questions.
 */
export const generateTheoryQuestions = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) => BaseInput.parse(input))
  .handler(async ({ data }) => {
    const system = [
      "You are a written theory examination question generator for students.",
      PDF_ONLY,
      `The student requested EXACTLY ${data.count} theory questions.`,
      `You must attempt to return EXACTLY ${data.count} UNIQUE questions.`,
      "Each question must be answerable using only the DOCUMENT.",
      "Question styles may include Define, Explain, Describe, Discuss, Compare, Contrast, Analyze and Evaluate.",
      "Provide a modelAnswer strictly based on the DOCUMENT.",
      "Provide keyPoints containing the important points supported by the DOCUMENT.",
      "Do not repeat or paraphrase existing questions.",
      "Never invent facts.",
      'Respond with JSON only: {"questions":[{"prompt":string,"modelAnswer":string,"keyPoints":[string],"sourceRef":string}]}',
    ].join("\n");

    const allQuestions: z.infer<typeof TheorySchema>[] = [];

    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remaining = data.count - allQuestions.length;

      if (remaining <= 0) break;

      const existingQuestions = allQuestions
        .map((q) => q.prompt)
        .join("\n");

      const parsed = await callAi(
        system,
        `
Generate EXACTLY ${remaining} NEW written theory questions.

Difficulty:
${data.difficulty}. ${DIFFICULTY_HINT[data.difficulty]}

Already generated questions:
${existingQuestions || "(none)"}

IMPORTANT:
- Do NOT repeat any existing question.
- Do NOT paraphrase an existing question.
- Every question, model answer and key point must be supported by the DOCUMENT.
- Return exactly ${remaining} questions if the DOCUMENT contains enough supported information.

DOCUMENT START
${data.pdfText.slice(0, 120000)}
DOCUMENT END
`,
      );

      const result = z
        .object({
          questions: z.array(TheorySchema),
        })
        .safeParse(parsed);

      if (!result.success) {
        if (attempt === maxAttempts - 1) {
          throw new Error(
            "The AI response could not be read. Please try again.",
          );
        }

        continue;
      }

      const newQuestions = dedupeTheory(result.data.questions);

      for (const question of newQuestions) {
        if (allQuestions.length >= data.count) break;

        const duplicate = allQuestions.some(
          (existing) =>
            normalizeQuestion(existing.prompt) ===
            normalizeQuestion(question.prompt),
        );

        if (!duplicate) {
          allQuestions.push(question);
        }
      }
    }

    if (allQuestions.length === 0) {
      throw new Error(
        "This PDF does not contain enough readable content to build questions from.",
      );
    }

    if (allQuestions.length < data.count) {
      throw new Error(
        `The PDF could only support ${allQuestions.length} unique theory questions out of the requested ${data.count}. No unsupported questions were invented.`,
      );
    }

    return {
      questions: allQuestions.slice(0, data.count),
    };
  });

/**
 * Grade theory answers.
 */
export const gradeTheoryAnswers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GradeInput.parse(input))
  .handler(async ({ data }) => {
    const system = [
      "You are a fair examiner grading written student answers.",
      PDF_ONLY,
      "Grade each answer out of 10.",
      "Grade based only on whether the student's meaning is supported by the DOCUMENT and the provided model answer/key points.",
      "Accept different wording, synonyms and paraphrases when the meaning is correct.",
      "Do not penalize spelling or writing style when the meaning is correct.",
      "An empty or completely unsupported answer scores 0.",
      "List correctPoints containing points the student successfully communicated.",
      "List missingPoints containing important points supported by the DOCUMENT that the student omitted.",
      "Give short constructive feedback.",
      'Respond with JSON only: {"grades":[{"score":0-10,"correctPoints":[string],"missingPoints":[string],"feedback":string}]}',
    ].join("\n");

    const items = data.items
      .map(
        (it, i) =>
          `ITEM ${i + 1}
QUESTION: ${it.prompt}
MODEL ANSWER: ${it.modelAnswer}
KEY POINTS: ${it.keyPoints.join("; ")}
STUDENT ANSWER: ${it.answer || "(no answer given)"}`,
      )
      .join("\n\n");

    const parsed = await callAi(
      system,
      `
Grade these ${data.items.length} student answers.

${items}

DOCUMENT START
${data.pdfText.slice(0, 100000)}
DOCUMENT END
`,
    );

    const result = z
      .object({
        grades: z.array(GradeSchema),
      })
      .safeParse(parsed);

    if (!result.success) {
      throw new Error("Grading failed. Please try again.");
    }

    const grades = data.items.map(
      (_, i) =>
        result.data.grades[i] ?? {
          score: 0,
          correctPoints: [],
          missingPoints: [],
          feedback: "This answer could not be graded.",
        },
    );

    return { grades };
  });
