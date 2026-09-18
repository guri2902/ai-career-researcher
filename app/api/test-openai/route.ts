import { NextResponse } from "next/server";
import { openai } from "@/lib/ai/openai";

export async function GET() {
  try {
    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: "Reply with exactly: OpenAI connection works.",
    });

    return NextResponse.json({
      success: true,
      response: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}