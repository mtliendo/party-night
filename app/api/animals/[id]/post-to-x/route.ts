import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAnimalById, updateAnimal } from "@/lib/db";
import { postAnimalToX } from "@/lib/x-post";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    // Must be logged in
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

    // Retrieve the bot's X token from Auth0 Token Vault
    const { token } = await auth0.getAccessTokenForConnection({
      connection: "twitter",
    });

    const tweetId = await postAnimalToX(
      token,
      animal.video_url,
      animal.x_handle,
      animal.image_url ?? undefined
    );

    // Update DB
    await updateAnimal(id, { status: "posted", tweet_id: tweetId });

    return NextResponse.json({ tweetId });
  } catch (err) {
    console.error("[POST /api/animals/[id]/post-to-x]", err);
    return NextResponse.json({ error: "Failed to post to X" }, { status: 500 });
  }
}
