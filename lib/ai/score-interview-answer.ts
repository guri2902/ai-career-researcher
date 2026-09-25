import { openrouter } from "@/lib/ai/openrouter";

export type ScoreInterviewAnswerInput = {
  question: string;
  category: string;
  difficulty: string;
  targetSkill: string;
  answer: string;
};

export type InterviewAnswerScore = {
  correctness_score: number;
  structure_score: number;
  specificity_score: number;
  communication_score: number;
  overall_score: number;

  feedback: string;
  stronger_answer: string;

  score_breakdown: {
    correctness: string;
    structure: string;
    specificity: string;
    communication: string;
  };

  answer_summary: string;
  missing_concepts: string[];
};

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");

    if (start === -1) {
      throw new Error("AI response did not contain a JSON object.");
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;

        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, i + 1));
        }
      }
    }

    throw new Error("Could not extract valid JSON from AI response.");
  }
}

function score(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(number)));
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function scoreInterviewAnswer(
  input: ScoreInterviewAnswerInput,
): Promise<InterviewAnswerScore> {
  const prompt = `
You are evaluating a technical interview answer.

QUESTION
${input.question}

CATEGORY
${input.category}

DIFFICULTY
${input.difficulty}

TARGET SKILL
${input.targetSkill}

CANDIDATE ANSWER
${input.answer}

Evaluate ONLY the answer given.

Important rules:

1. Do not invent experience for the candidate.
2. Do not assume they used a technology simply because they mention it.
3. For hypothetical questions, evaluate technical reasoning.
4. For project questions, distinguish between completed experience and proposed/planned work.
5. For behavioral questions, evaluate structure, specificity and evidence.
6. Communication score must be based on the clarity and organization of the transcript.
7. Identify concepts that were missing or weak. These will be used to generate the interviewer's next question.
8. The stronger answer must stay grounded in the candidate's answer and the question.
9. Do not add fake metrics, employers, projects or technologies.

Return ONLY JSON:

{
  "correctness_score": 1,
  "structure_score": 1,
  "specificity_score": 1,
  "communication_score": 1,
  "feedback": "Detailed but concise feedback.",
  "stronger_answer": "A stronger example answer grounded in the candidate's response.",
  "score_breakdown": {
    "correctness": "Why this score.",
    "structure": "Why this score.",
    "specificity": "Why this score.",
    "communication": "Why this score."
  },
  "answer_summary": "What the candidate actually demonstrated.",
  "missing_concepts": [
    "Concept that was missing",
    "Concept that needs deeper explanation"
  ]
}
`;

  const completion = await openrouter.chat.completions.create({
    model: "inclusionai/ling-3.0-flash-fin:free",
    messages: [
      {
        role: "system",
        content: "Return only valid JSON. No markdown. No commentary.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.15,
    max_tokens: 2800,
  });

  const responseText = completion.choices?.[0]?.message?.content;

  if (!responseText || typeof responseText !== "string") {
    throw new Error("OpenRouter returned no scoring response.");
  }

  const parsed = extractJson(responseText) as Record<string, unknown>;

  const correctness = score(parsed.correctness_score);
  const structure = score(parsed.structure_score);
  const specificity = score(parsed.specificity_score);
  const communication = score(parsed.communication_score);

  const overall =
    (correctness + structure + specificity + communication) / 4;

  const breakdown =
    parsed.score_breakdown &&
    typeof parsed.score_breakdown === "object"
      ? (parsed.score_breakdown as Record<string, unknown>)
      : {};

  return {
    correctness_score: correctness,
    structure_score: structure,
    specificity_score: specificity,
    communication_score: communication,
    overall_score: Number(overall.toFixed(2)),

    feedback: stringValue(
      parsed.feedback,
      "The answer was evaluated against the interview question.",
    ),

    stronger_answer: stringValue(
      parsed.stronger_answer,
      "A stronger answer should clearly explain the main concept, implementation approach, trade-offs and practical considerations.",
    ),

    score_breakdown: {
      correctness: stringValue(
        breakdown.correctness,
        "Correctness was evaluated against the question.",
      ),
      structure: stringValue(
        breakdown.structure,
        "Structure was evaluated based on organization and flow.",
      ),
      specificity: stringValue(
        breakdown.specificity,
        "Specificity was evaluated based on concrete technical detail.",
      ),
      communication: stringValue(
        breakdown.communication,
        "Communication was evaluated based on transcript clarity.",
      ),
    },

    answer_summary: stringValue(
      parsed.answer_summary,
      "The candidate provided a technical response to the question.",
    ),

    missing_concepts: stringArray(parsed.missing_concepts),
  };
}