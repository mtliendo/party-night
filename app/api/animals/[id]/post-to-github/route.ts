import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAnimalById, updateAnimal } from "@/lib/db";
import { createAnimalIssue } from "@/lib/github-post";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const animal = await getAnimalById(id);

    if (!animal) {
      return NextResponse.json({ error: "Animal not found" }, { status: 404 });
    }
    if (!animal.video_url) {
      return NextResponse.json(
        { error: "Video not ready yet" },
        { status: 422 }
      );
    }

    const { token } = await auth0.getAccessTokenForConnection({
      connection: "github",
    });

    const issue = await createAnimalIssue({
      token,
      githubHandle: animal.github_handle,
      imageUrl: animal.image_url ?? undefined,
      videoUrl: animal.video_url,
    } as { token: string; githubHandle: string; imageUrl: string; videoUrl?: string });

    await updateAnimal(id, { status: "posted", issue_url: issue.url });

    return NextResponse.json({ issueUrl: issue.url });
  } catch (err) {
    console.error("[POST /api/animals/[id]/post-to-github]", err);
    return NextResponse.json({ error: "Failed to post to GitHub" }, { status: 500 });
  }
}
