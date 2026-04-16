import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getAnimalById, updateAnimal } from "@/lib/db";

const WALL_URL = process.env.APP_BASE_URL
  ? `${process.env.APP_BASE_URL}/wall`
  : "https://party-animals.vercel.app/wall";

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
    if (animal.status === "posted") {
      return NextResponse.json({ error: "Already posted" }, { status: 409 });
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

    const tweetText = buildTweetText(animal.x_handle);

    // Step 1 — INIT upload
    const mediaId = await uploadVideoToX(token, animal.video_url);

    // Step 2 — Create tweet
    const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: tweetText,
        media: { media_ids: [mediaId] },
      }),
    });

    if (!tweetRes.ok) {
      const err = await tweetRes.text();
      throw new Error(`Tweet creation failed: ${tweetRes.status} ${err}`);
    }

    const tweetData = await tweetRes.json();
    const tweetId: string = tweetData.data?.id;

    // Update DB
    await updateAnimal(id, { status: "posted", tweet_id: tweetId });

    return NextResponse.json({ tweetId });
  } catch (err) {
    console.error("[POST /api/animals/[id]/post-to-x]", err);
    return NextResponse.json({ error: "Failed to post to X" }, { status: 500 });
  }
}

function buildTweetText(xHandle: string) {
  const handle = xHandle.startsWith("@") ? xHandle : `@${xHandle}`;
  return `🎉 Meet ${handle}'s party animal, brought to life by AI!\n\nCheck out all the animals → ${WALL_URL}\n\n@auth0 @ReactMiami`;
}

// Chunked X media upload: INIT → APPEND → FINALIZE
async function uploadVideoToX(token: string, videoUrl: string): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to fetch video for upload");
  const videoBuffer = await videoRes.arrayBuffer();
  const totalBytes = videoBuffer.byteLength;

  const uploadBase = "https://upload.twitter.com/1.1/media/upload.json";

  // INIT
  const initParams = new URLSearchParams({
    command: "INIT",
    total_bytes: totalBytes.toString(),
    media_type: "video/mp4",
    media_category: "tweet_video",
  });
  const initRes = await fetch(`${uploadBase}?${initParams}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!initRes.ok) {
    throw new Error(`INIT failed: ${initRes.status} ${await initRes.text()}`);
  }
  const { media_id_string: mediaId } = await initRes.json();

  // APPEND — chunks of 1 MB
  const CHUNK_SIZE = 1024 * 1024;
  const bytes = new Uint8Array(videoBuffer);
  let segmentIndex = 0;

  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    const appendForm = new FormData();
    appendForm.append("command", "APPEND");
    appendForm.append("media_id", mediaId);
    appendForm.append("segment_index", segmentIndex.toString());
    appendForm.append("media", new Blob([chunk]), "chunk.mp4");

    const appendRes = await fetch(uploadBase, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: appendForm,
    });
    if (!appendRes.ok) {
      throw new Error(`APPEND failed at segment ${segmentIndex}: ${appendRes.status}`);
    }
    segmentIndex++;
  }

  // FINALIZE
  const finalizeParams = new URLSearchParams({
    command: "FINALIZE",
    media_id: mediaId,
  });
  const finalizeRes = await fetch(`${uploadBase}?${finalizeParams}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!finalizeRes.ok) {
    throw new Error(`FINALIZE failed: ${finalizeRes.status} ${await finalizeRes.text()}`);
  }

  const finalizeData = await finalizeRes.json();

  // Poll for processing if needed
  if (finalizeData.processing_info?.state === "pending") {
    await pollMediaProcessing(token, mediaId, uploadBase);
  }

  return mediaId;
}

async function pollMediaProcessing(
  token: string,
  mediaId: string,
  uploadBase: string
) {
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const statusRes = await fetch(
      `${uploadBase}?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!statusRes.ok) continue;
    const data = await statusRes.json();
    const state = data.processing_info?.state;
    if (state === "succeeded") return;
    if (state === "failed") throw new Error("X media processing failed");
  }
  throw new Error("X media processing timed out");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
