const UPLOAD_BASE = 'https://upload.twitter.com/1.1/media/upload.json'

const TWEET_TEMPLATES = [
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: 🐾 ${handle} just dropped their party animal and it's incredible! AI did that. 🤯\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: The AI-powered party animal by ${handle} has entered the chat 🦄✨\n\nPowered by Auth0 Token Vault + Grok\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: We asked AI to bring ${handle}'s drawing to life and honestly? No notes. 🎨🔥\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: ${handle}'s party animal is here and it's ready to PARTY 🥳🐉\n\nAI-generated live at React Miami!\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: Look what ${handle} created at the React Miami booth 👀\n\nDrawing → AI video in seconds, secured by Auth0 Token Vault 🔐\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: Big things happening at React Miami 🌴 ${handle} just unleashed their AI party animal into the wild 🐆\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: ${handle} drew this. Grok animated it. Auth0 posted it. No humans were harmed 🤖🎉\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: Behold ${handle}'s party animal — hand-drawn, AI-animated, and ready to crash the feed 🎊\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string, imageUrl: string) =>
    `AI Demo: React Miami is wild 🌴 ${handle}'s party animal just went live thanks to AI + Auth0 Token Vault 🔑\n\n🖼️ ${imageUrl}\n🎬 ${videoUrl}`,
]

export function buildTweetText(
  xHandle: string,
  videoUrl: string,
  imageUrl?: string,
) {
  const handle = xHandle.startsWith('@') ? xHandle : `@${xHandle}`
  const template =
    TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)]
  return template(handle, videoUrl, imageUrl ?? '')
}

async function createTweet(
  token: string,
  text: string,
  mediaIds?: string[],
): Promise<string> {
  const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      ...(mediaIds && mediaIds.length > 0
        ? { media: { media_ids: mediaIds } }
        : {}),
    }),
  })

  if (!tweetRes.ok) {
    const err = await tweetRes.text()
    throw new Error(`Tweet creation failed: ${tweetRes.status} ${err}`)
  }

  const tweetData = await tweetRes.json()
  return tweetData.data?.id as string
}

/** Chunked X media upload: INIT → APPEND → FINALIZE. Returns media_id_string. */
export async function uploadVideoToX(
  token: string,
  videoUrl: string,
): Promise<string> {
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error('Failed to fetch video for upload')
  const videoBuffer = await videoRes.arrayBuffer()
  const totalBytes = videoBuffer.byteLength

  // INIT
  const initParams = new URLSearchParams({
    command: 'INIT',
    total_bytes: totalBytes.toString(),
    media_type: 'video/mp4',
    media_category: 'tweet_video',
  })
  const initRes = await fetch(`${UPLOAD_BASE}?${initParams}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!initRes.ok) {
    throw new Error(`INIT failed: ${initRes.status} ${await initRes.text()}`)
  }
  const { media_id_string: mediaId } = await initRes.json()

  // APPEND — chunks of 1 MB
  const CHUNK_SIZE = 1024 * 1024
  const bytes = new Uint8Array(videoBuffer)
  let segmentIndex = 0

  for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
    const appendForm = new FormData()
    appendForm.append('command', 'APPEND')
    appendForm.append('media_id', mediaId)
    appendForm.append('segment_index', segmentIndex.toString())
    appendForm.append('media', new Blob([chunk]), 'chunk.mp4')

    const appendRes = await fetch(UPLOAD_BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: appendForm,
    })
    if (!appendRes.ok) {
      throw new Error(
        `APPEND failed at segment ${segmentIndex}: ${appendRes.status}`,
      )
    }
    segmentIndex++
  }

  // FINALIZE
  const finalizeParams = new URLSearchParams({
    command: 'FINALIZE',
    media_id: mediaId,
  })
  const finalizeRes = await fetch(`${UPLOAD_BASE}?${finalizeParams}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!finalizeRes.ok) {
    throw new Error(
      `FINALIZE failed: ${finalizeRes.status} ${await finalizeRes.text()}`,
    )
  }

  const finalizeData = await finalizeRes.json()
  if (finalizeData.processing_info?.state === 'pending') {
    await pollMediaProcessing(token, mediaId)
  }

  return mediaId
}

/** Upload an image (PNG) and return `media_id_string`. */
export async function uploadImageToX(
  token: string,
  imageUrl: string,
): Promise<string> {
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error('Failed to fetch image for upload')
  const imageBuffer = await imageRes.arrayBuffer()

  const form = new FormData()
  form.append('media', new Blob([imageBuffer], { type: 'image/png' }), 'image.png')

  const uploadRes = await fetch(UPLOAD_BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    console.error('[uploadImageToX] 403 response body:', body)
    throw new Error(`Image upload failed: ${uploadRes.status} ${body}`)
  }

  const { media_id_string: mediaId } = await uploadRes.json()
  return mediaId
}

async function pollMediaProcessing(token: string, mediaId: string) {
  for (let i = 0; i < 30; i++) {
    await sleep(5000)
    const statusRes = await fetch(
      `${UPLOAD_BASE}?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!statusRes.ok) continue
    const data = await statusRes.json()
    const state = data.processing_info?.state
    if (state === 'succeeded') return
    if (state === 'failed') throw new Error('X media processing failed')
  }
  throw new Error('X media processing timed out')
}

/** Upload image (optional) + video and create the tweet. Returns the tweet ID. */
export async function postAnimalToX(
  token: string,
  videoUrl: string,
  xHandle: string,
  imageUrl?: string,
): Promise<string> {
  const tweetText = buildTweetText(xHandle, videoUrl, imageUrl)

  // Embed the image as attached media; video URL is already in the tweet text.
  // X does not allow mixing image + video media_ids in a single tweet.
  let imageMediaId: string | null = null
  if (imageUrl) {
    try {
      imageMediaId = await uploadImageToX(token, imageUrl)
      console.log('[postAnimalToX] Image uploaded, media_id:', imageMediaId)
    } catch (err) {
      console.error('[postAnimalToX] Image upload failed:', err)
    }
  }

  return await createTweet(token, tweetText, imageMediaId ? [imageMediaId] : undefined)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
