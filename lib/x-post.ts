const UPLOAD_BASE = "https://upload.twitter.com/1.1/media/upload.json";

export function buildTweetText(xHandle: string, imageUrl?: string, videoUrl?: string) {
  const handle = xHandle.startsWith("@") ? xHandle : `@${xHandle}`;
  const links = [
    imageUrl ? `Original drawing: ${imageUrl}` : null,
    videoUrl ? `Video: ${videoUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `🎉 Meet ${handle}'s party animal, brought to life by AI!${
    links ? `\n\n${links}` : ""
  }`;
}

async function createTweet(token: string, text: string, mediaIds?: string[]): Promise<string> {
  const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      ...(mediaIds && mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
    }),
  });

  if (!tweetRes.ok) {
    const err = await tweetRes.text();
    throw new Error(`Tweet creation failed: ${tweetRes.status} ${err}`);
  }

  const tweetData = await tweetRes.json();
  return tweetData.data?.id as string;
}

/** Chunked X media upload: INIT → APPEND → FINALIZE. Returns media_id_string. */
export async function uploadVideoToX(token: string, videoUrl: string): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to fetch video for upload");
  const videoBuffer = await videoRes.arrayBuffer();
  const totalBytes = videoBuffer.byteLength;

  // INIT
  const initParams = new URLSearchParams({
    command: "INIT",
    total_bytes: totalBytes.toString(),
    media_type: "video/mp4",
    media_category: "tweet_video",
  });
  const initRes = await fetch(`${UPLOAD_BASE}?${initParams}`, {
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

    const appendRes = await fetch(UPLOAD_BASE, {
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
  const finalizeParams = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const finalizeRes = await fetch(`${UPLOAD_BASE}?${finalizeParams}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!finalizeRes.ok) {
    throw new Error(`FINALIZE failed: ${finalizeRes.status} ${await finalizeRes.text()}`);
  }

  const finalizeData = await finalizeRes.json();
  if (finalizeData.processing_info?.state === "pending") {
    await pollMediaProcessing(token, mediaId);
  }

  return mediaId;
}

/** Upload an image (PNG) and return `media_id_string`. */
export async function uploadImageToX(token: string, imageUrl: string): Promise<string> {
  // The app uploads the drawing as `drawing.png` (image/png), so we can safely initialize
  // the media upload as a PNG.
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error("Failed to fetch image for upload");
  const imageBuffer = await imageRes.arrayBuffer();
  const totalBytes = imageBuffer.byteLength;

  // INIT
  const initParams = new URLSearchParams({
    command: "INIT",
    total_bytes: totalBytes.toString(),
    media_type: "image/png",
    media_category: "tweet_image",
  });
  const initRes = await fetch(`${UPLOAD_BASE}?${initParams}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!initRes.ok) {
    throw new Error(`INIT failed: ${initRes.status} ${await initRes.text()}`);
  }
  const { media_id_string: mediaId } = await initRes.json();

  // APPEND — chunks of 1 MB
  const CHUNK_SIZE = 1024 * 1024;
  const bytes = new Uint8Array(imageBuffer);
  let segmentIndex = 0;

  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    const appendForm = new FormData();
    appendForm.append("command", "APPEND");
    appendForm.append("media_id", mediaId);
    appendForm.append("segment_index", segmentIndex.toString());
    appendForm.append("media", new Blob([chunk]), "chunk.png");

    const appendRes = await fetch(UPLOAD_BASE, {
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
  const finalizeParams = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const finalizeRes = await fetch(`${UPLOAD_BASE}?${finalizeParams}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!finalizeRes.ok) {
    throw new Error(`FINALIZE failed: ${finalizeRes.status} ${await finalizeRes.text()}`);
  }

  const finalizeData = await finalizeRes.json();
  if (finalizeData.processing_info?.state === "pending") {
    await pollMediaProcessing(token, mediaId);
  }

  return mediaId;
}

async function pollMediaProcessing(token: string, mediaId: string) {
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const statusRes = await fetch(
      `${UPLOAD_BASE}?command=STATUS&media_id=${mediaId}`,
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

/** Upload image (optional) + video and create the tweet. Returns the tweet ID. */
export async function postAnimalToX(
  token: string,
  videoUrl: string,
  xHandle: string,
  imageUrl?: string
): Promise<string> {
  const tweetText = buildTweetText(xHandle, imageUrl, videoUrl);

  // Upload both media up-front. If X rejects mixed media in a single tweet,
  try {
    // we retry with video-only using the already-uploaded video. If media upload itself
    // is forbidden, we fall back to a text-only tweet so the bot still posts.
    const videoMediaId = await uploadVideoToX(token, videoUrl);
    const imageMediaId = imageUrl ? await uploadImageToX(token, imageUrl) : null;
    const mixedMediaIds = imageMediaId ? [imageMediaId, videoMediaId] : [videoMediaId];

    try {
      return await createTweet(token, tweetText, mixedMediaIds);
    } catch (err) {
      if (!imageMediaId) throw err;
      console.warn(
        "[postAnimalToX] Mixed image+video tweet failed; retrying with video-only:",
        err
      );
      return await createTweet(token, tweetText, [videoMediaId]);
    }
  } catch (err) {
    console.warn(
      "[postAnimalToX] Media upload failed; falling back to text-only tweet:",
      err
    );
    return await createTweet(token, tweetText);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
