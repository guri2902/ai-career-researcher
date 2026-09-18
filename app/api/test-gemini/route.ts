import { NextResponse } from "next/server";
import { gemini } from "@/lib/ai/gemini";

export async function GET() {
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Reply with exactly: Gemini connection works.",
    });

    return NextResponse.json({
      success: true,
      response: response.text,
    });
  } catch (error) {
    console.error("Gemini test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}