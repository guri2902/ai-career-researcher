import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: profile, error: profileError } = await supabase
      .from("candidate_profiles")
      .select("*")
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
      return NextResponse.json({
        profile: null,
        skills: [],
      });
    }

    const { data: skills, error: skillsError } = await supabase
      .from("candidate_skills")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });

    if (skillsError) {
      return NextResponse.json(
        { error: skillsError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      profile,
      skills: skills ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load profile.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const resumeText =
      typeof body.resumeText === "string"
        ? body.resumeText.trim()
        : "";

    const skills = Array.isArray(body.skills)
      ? body.skills
          .filter(
            (skill: unknown) =>
              skill &&
              typeof skill === "object" &&
              typeof (skill as { skillName?: unknown }).skillName ===
                "string",
          )
          .map(
            (skill: {
              skillName: string;
              proficiency?: string;
            }) => ({
              skillName: skill.skillName.trim(),
              proficiency: skill.proficiency || "beginner",
            }),
          )
          .filter((skill: { skillName: string }) => skill.skillName)
      : [];

    const supabase = await createClient();

    // For the MVP we keep one candidate profile.
    const { data: existingProfile } = await supabase
      .from("candidate_profiles")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let profileId: string;

    if (existingProfile) {
      const { data: updatedProfile, error: updateError } =
        await supabase
          .from("candidate_profiles")
          .update({
            resume_text: resumeText || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProfile.id)
          .select()
          .single();

      if (updateError || !updatedProfile) {
        return NextResponse.json(
          {
            error:
              updateError?.message ||
              "Failed to update profile.",
          },
          { status: 500 },
        );
      }

      profileId = updatedProfile.id;
    } else {
      const { data: newProfile, error: insertError } =
        await supabase
          .from("candidate_profiles")
          .insert({
            resume_text: resumeText || null,
          })
          .select()
          .single();

      if (insertError || !newProfile) {
        return NextResponse.json(
          {
            error:
              insertError?.message ||
              "Failed to create profile.",
          },
          { status: 500 },
        );
      }

      profileId = newProfile.id;
    }

    // Replace existing skills.
    const { error: deleteError } = await supabase
      .from("candidate_skills")
      .delete()
      .eq("profile_id", profileId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 },
      );
    }

    if (skills.length > 0) {
      const { error: skillsError } = await supabase
        .from("candidate_skills")
        .insert(
          skills.map(
            (skill: {
              skillName: string;
              proficiency: string;
            }) => ({
              profile_id: profileId,
              skill_name: skill.skillName,
              proficiency: skill.proficiency,
              source: "self-rated",
            }),
          ),
        );

      if (skillsError) {
        return NextResponse.json(
          { error: skillsError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      profileId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save profile.",
      },
      { status: 500 },
    );
  }
}