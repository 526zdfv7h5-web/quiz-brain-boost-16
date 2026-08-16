import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  "If the DOCUMENT does not support the requested number of questions, return fewer questions.",
].join("\n");

const DIFFICULTY_HINT = {
  easy: "Easy: direct recall of explicitly stated facts.",
  medium: "Medium: applying or comparing stated facts within the document.",
  hard: "Hard: multi-step reasoning that still relies only on stated document content.",
} as const;

async function callAi(system: string, user: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
  });

  if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
  if (res.status === 402)
    throw new Error("AI credits exhausted. Add credits to continue generating quizzes.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);

  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("The AI response could not be read. Please try again.");
  }
}

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BaseInput.parse(input))
  .handler(async ({ data }) => {
    const system = [
      "You are a multiple-choice quiz generator for students.",
      PDF_ONLY,
      "Each question must have exactly 4 options and exactly one correct answer.",
      "Distractors must be plausible and drawn from the DOCUMENT's own terminology, never nonsense.",
      "Do not repeat or paraphrase the same question twice. Vary which option letter is correct.",
      "Include a short explanation of why the correct answer is right, quoting or paraphrasing the DOCUMENT.",
      "Include a sourceRef naming the page and/or section of the DOCUMENT that supports it (e.g. 'Page 3 — Photosynthesis'). Use an empty string if the page is unknown.",
      'Respond with JSON only: {"questions":[{"prompt":string,"options":[string,string,string,string],"correctIndex":0-3,"explanation":string,"sourceRef":string}]}',
    ].join("\n");

    const parsed = await callAi(
      system,
      `Generate up to ${data.count} multiple-choice questions in JSON.\nDifficulty: ${data.difficulty}. ${DIFFICULTY_HINT[data.difficulty]}\n\nDOCUMENT START\n${data.pdfText.slice(0, 120000)}\nDOCUMENT END`,
    );

    const result = z.object({ questions: z.array(McqSchema) }).safeParse(parsed);
    if (!result.success) throw new Error("The AI response could not be read. Please try again.");
    const questions = result.data.questions.slice(0, data.count);
    if (questions.length === 0)
      throw new Error("This PDF does not contain enough readable content to build questions from.");
    return { questions };
  });

export const generateTheoryQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BaseInput.parse(input))
  .handler(async ({ data }) => {
    const system = [
      "You are a written (theory) exam question generator for students.",
      PDF_ONLY,
      "Each question must be answerable in a few sentences using only the DOCUMENT.",
      "Provide a modelAnswer written strictly from the DOCUMENT, and keyPoints: the specific points a correct answer must mention.",
      "Do not repeat questions.",
      'Respond with JSON only: {"questions":[{"prompt":string,"modelAnswer":string,"keyPoints":[string],"sourceRef":string}]}',
    ].join("\n");

    const parsed = await callAi(
      system,
      `Generate up to ${data.count} written theory questions in JSON.\nDifficulty: ${data.difficulty}. ${DIFFICULTY_HINT[data.difficulty]}\n\nDOCUMENT START\n${data.pdfText.slice(0, 120000)}\nDOCUMENT END`,
    );

    const result = z.object({ questions: z.array(TheorySchema) }).safeParse(parsed);
    if (!result.success) throw new Error("The AI response could not be read. Please try again.");
    const questions = result.data.questions.slice(0, data.count);
    if (questions.length === 0)
      throw new Error("This PDF does not contain enough readable content to build questions from.");
    return { questions };
  });

export const gradeTheoryAnswers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GradeInput.parse(input))
  .handler(async ({ data }) => {
    const system = [
      "You are a fair examiner grading written student answers.",
      PDF_ONLY,
      "Grade each answer out of 10 based only on whether its meaning is supported by the DOCUMENT and the model answer.",
      "Accept different wording, synonyms and paraphrase when the meaning matches. Do not penalise style or spelling.",
      "An empty or off-topic answer scores 0.",
      "List correctPoints (points the student got) and missingPoints (points from the DOCUMENT they omitted), plus short encouraging feedback.",
      'Respond with JSON only: {"grades":[{"score":0-10,"correctPoints":[string],"missingPoints":[string],"feedback":string}]} with one grade per item, in order.',
    ].join("\n");

    const items = data.items
      .map(
        (it, i) =>
          `ITEM ${i + 1}\nQUESTION: ${it.prompt}\nMODEL ANSWER: ${it.modelAnswer}\nKEY POINTS: ${it.keyPoints.join("; ")}\nSTUDENT ANSWER: ${it.answer || "(no answer given)"}`,
      )
      .join("\n\n");

    const parsed = await callAi(
      system,
      `Grade these ${data.items.length} answers.\n\n${items}\n\nDOCUMENT START\n${data.pdfText.slice(0, 100000)}\nDOCUMENT END`,
    );

    const result = z.object({ grades: z.array(GradeSchema) }).safeParse(parsed);
    if (!result.success) throw new Error("Grading failed. Please try again.");
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
