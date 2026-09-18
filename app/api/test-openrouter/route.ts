import { NextResponse } from "next/server";
import { openrouter } from "@/lib/ai/openrouter";

export async function GET() {
  try {
    const response = await openrouter.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "user",
          content: "Reply with exactly: OpenRouter connection works.",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      model: response.model,
      response: response.choices[0]?.message?.content,
    });
  } catch (error) {
    console.error("OpenRouter test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}