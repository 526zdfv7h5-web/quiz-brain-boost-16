import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  pdfText: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(30),
});

const QuestionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  sourceRef: z.string().default(""),
});

const ResponseSchema = z.object({
  questions: z.array(QuestionSchema),
});

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const source = data.pdfText.slice(0, 120000);

    const system = [
      "You are a quiz generator for students.",
      "The DOCUMENT provided by the user is the ONLY authoritative source of information.",
      "You must not use outside knowledge, memory, web search, or general knowledge.",
      "Every question, every answer option, and the correct answer must be directly supported by explicit text in the DOCUMENT.",
      "Never invent, infer beyond, or hallucinate facts that are not present in the DOCUMENT.",
      "If the DOCUMENT does not support the requested number of questions, return fewer questions. Returning an empty list is acceptable when the document has no usable content.",
      "For each question include a sourceRef naming the page and/or section of the DOCUMENT that supports it (e.g. 'Page 3 — Photosynthesis').",
      "Each question must have exactly 4 options and exactly one correct answer.",
      "Respond with JSON only, matching: {\"questions\":[{\"prompt\":string,\"options\":[string,string,string,string],\"correctIndex\":0-3,\"sourceRef\":string}]}",
    ].join("\n");

    const difficultyHint = {
      easy: "Easy: direct recall of explicitly stated facts.",
      medium: "Medium: applying or comparing stated facts within the document.",
      hard: "Hard: multi-step reasoning that still relies only on stated document content.",
    }[data.difficulty];

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
          {
            role: "user",
            content: `Generate up to ${data.count} multiple-choice questions in JSON.\nDifficulty: ${data.difficulty}. ${difficultyHint}\n\nDOCUMENT START\n${source}\nDOCUMENT END`,
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits to continue generating quizzes.");
    if (!res.ok) throw new Error(`Quiz generation failed (${res.status}).`);

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("The AI response could not be read. Please try again.");
    }

    const result = ResponseSchema.safeParse(parsed);
    if (!result.success)
      throw new Error("The AI response could not be read. Please try again.");

    const questions = result.data.questions.slice(0, data.count);
    if (questions.length === 0)
      throw new Error(
        "This PDF does not contain enough readable content to build questions from.",
      );

    return { questions };
  });
