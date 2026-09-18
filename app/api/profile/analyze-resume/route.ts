import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { extractResumeSkills } from "@/lib/ai/extract-resume-skills";

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: profile, error: profileError } =
      await supabase
        .from("candidate_profiles")
        .select("id, resume_text")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Candidate profile not found." },
        { status: 404 },
      );
    }

    if (!profile.resume_text?.trim()) {
      return NextResponse.json(
        {
          error:
            "Please save your resume before analyzing it.",
        },
        { status: 400 },
      );
    }

    const extractedSkills = await extractResumeSkills(
      profile.resume_text,
    );

    // Remove previous resume-inferred skills only.
    // Self-rated skills remain untouched.
    const { error: deleteError } = await supabase
      .from("candidate_skills")
      .delete()
      .eq("profile_id", profile.id)
      .eq("source", "resume");

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 },
      );
    }

    if (extractedSkills.length > 0) {
      const rows = extractedSkills.map((skill) => ({
        profile_id: profile.id,
        skill_name: skill.skill_name,
        proficiency: "inferred",
        source: "resume",
      }));

      const { error: insertError } = await supabase
        .from("candidate_skills")
        .insert(rows);

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      skills: extractedSkills,
    });
  } catch (error) {
    console.error("Resume analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze resume.",
      },
      { status: 500 },
    );
  }
}