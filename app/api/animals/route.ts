import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createAnimal, getAllAnimals, updateAnimal } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const animals = await getAllAnimals();
    return NextResponse.json(animals);
  } catch (err) {
    console.error("[GET /api/animals]", err);
    return NextResponse.json({ error: "Failed to fetch animals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const xHandle = formData.get("xHandle") as string | null;

    if (!imageFile || !xHandle) {
      return NextResponse.json(
        { error: "Missing image or xHandle" },
        { status: 400 }
      );
    }

    // 1. Upload original drawing to Vercel Blob
    const imageId = uuidv4();
    const imageBuffer = await imageFile.arrayBuffer();
    const imageBlob = await put(`animals/${imageId}/drawing.png`, imageBuffer, {
      access: "public",
      token: process.env.PARTY_ANIMAL_BLOB_READ_WRITE_TOKEN,
      contentType: "image/png",
    });

    // 2. Save initial record to DB
    const animal = await createAnimal({
      x_handle: xHandle.startsWith("@") ? xHandle : `@${xHandle}`,
      image_url: imageBlob.url,
    });

    // 3. Kick off video generation async (don't await — respond fast)
    void generateAndSaveVideo(animal.id, imageBlob.url).catch((err) =>
      console.error("[generateAndSaveVideo]", err)
    );

    return NextResponse.json(animal, { status: 201 });
  } catch (err) {
    console.error("[POST /api/animals]", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}

async function generateAndSaveVideo(animalId: string, imageUrl: string) {
  const xaiBase = "https://api.x.ai/v1";
  const apiKey = process.env.XAI_API_KEY!;

  // Fetch the image from Vercel Blob and convert to base64 data URL
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString("base64");
  const mimeType = imgRes.headers.get("content-type") ?? "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // Initiate video generation
  const initRes = await fetch(`${xaiBase}/videos/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-video",
      prompt: "Animate this party animal drawing — make it fun, bouncy, and full of energy!",
      duration: 5,
      resolution: "480p",
      image: { url: dataUrl },
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Video generation init failed: ${initRes.status} ${text}`);
  }

  const initData = await initRes.json();

  // x.ai returns request_id for polling
  const requestId: string = initData.request_id;
  if (!requestId) {
    throw new Error(`No request_id returned from video API: ${JSON.stringify(initData)}`);
  }

  // 4. Poll until complete (max 3 min, every 5s)
  let videoUrl: string | null = null;
  const maxAttempts = 36;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);

    const pollRes = await fetch(`${xaiBase}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status: string = pollData.status ?? pollData.state ?? "processing";

    if (status === "done") {
      videoUrl = pollData.video?.url ?? pollData.video_url ?? pollData.url;
      break;
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Video generation failed: ${JSON.stringify(pollData)}`);
    }
  }

  if (!videoUrl) {
    throw new Error("Video generation timed out");
  }

  // 5. Download video and re-upload to Vercel Blob
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to download generated video");

  const videoBuffer = await videoRes.arrayBuffer();
  const stored = await put(`animals/${animalId}/video.mp4`, videoBuffer, {
    access: "public",
    token: process.env.PARTY_ANIMAL_BLOB_READ_WRITE_TOKEN,
    contentType: "video/mp4",
  });

  // 6. Update DB record
  await updateAnimal(animalId, { video_url: stored.url, status: "approved" });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
