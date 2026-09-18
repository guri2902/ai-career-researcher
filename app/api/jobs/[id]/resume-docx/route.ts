import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SECTION_HEADINGS = new Set([
  "CAREER SUMMARY",
  "SUMMARY",
  "EXPERIENCE",
  "EDUCATION",
  "TECHNICAL SKILLS",
  "SKILLS",
  "CERTIFICATIONS",
  "PROJECTS",
  "PRODUCT DEVELOPMENT",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const { data: resume, error: resumeError } =
      await supabase
        .from("resume_variants")
        .select("tailored_text")
        .eq("job_id", id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (resumeError) {
      return NextResponse.json(
        { error: resumeError.message },
        { status: 500 },
      );
    }

    if (!resume) {
      return NextResponse.json(
        {
          error:
            "No tailored resume has been generated yet.",
        },
        { status: 404 },
      );
    }

    const lines: string[] =
      resume.tailored_text.split("\n");

    const children: Paragraph[] = lines.map(
      (line: string) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return new Paragraph({
            text: "",
            spacing: {
              after: 100,
            },
          });
        }

        const upper = trimmed.toUpperCase();

        const isHeading =
          SECTION_HEADINGS.has(upper);

        if (isHeading) {
          return new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                bold: true,
                size: 24,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: {
              before: 240,
              after: 120,
            },
          });
        }

        const isBullet =
          trimmed.startsWith("•") ||
          trimmed.startsWith("-");

        const content = isBullet
          ? trimmed.replace(/^[-•]\s*/, "")
          : trimmed;

        return new Paragraph({
          children: [
            new TextRun({
              text: content,
              size: 21,
            }),
          ],

          bullet: isBullet
            ? {
                level: 0,
              }
            : undefined,

          spacing: {
            after: 100,
            line: 300,
          },
        });
      },
    );

    const document = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                bottom: 720,
                left: 900,
                right: 900,
              },
            },
          },

          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(
      document,
    );

    return new NextResponse(
      buffer as unknown as BodyInit,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            'attachment; filename="tailored-resume.docx"',

          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "DOCX generation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate DOCX.",
      },
      { status: 500 },
    );
  }
}