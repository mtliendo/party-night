import { Client } from '@xdevplatform/xdk'

const TWEET_TEMPLATES = [
  (handle: string, videoUrl: string) =>
    `AI Demo: 🐾 ${handle} just dropped their party animal and it's incredible! AI did that — and Auth0 Token Vault posted it. 🤯\n\nWatch the animation 🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: The AI-powered party animal by ${handle} has entered the chat 🦄✨\n\nGrok animated it. Auth0 Token Vault handled posting it securely. No credentials were harmed.\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: We asked AI to bring ${handle}'s drawing to life and honestly? No notes. 🎨🔥\n\nPosted autonomously via Auth0 Token Vault — this is what agentic auth looks like.\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: ${handle}'s party animal is here and it's ready to PARTY 🥳🐉\n\nAI-generated live at CascadiaJS, posted by an agent using Auth0 Token Vault 🔐\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: Look what ${handle} created at the CascadiaJS booth 👀\n\nDrawing → AI video in seconds. Auth0 Token Vault handled the rest — no hardcoded credentials, ever.\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: Big things happening at CascadiaJS 🌲 ${handle} just unleashed their AI party animal 🐆\n\nThis post? Fully automated via Auth0 Token Vault. Agents with credentials, done right.\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: ${handle} drew this. Grok animated it. Auth0 Token Vault posted it. No humans were harmed 🤖🎉\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: Behold ${handle}'s party animal — hand-drawn, AI-animated, posted by an agent 🎊\n\nAuth0 Token Vault keeps bot credentials secure so agents can act on your behalf safely.\n\n🎬 ${videoUrl}`,
  (handle: string, videoUrl: string) =>
    `AI Demo: CascadiaJS is wild 🌲 ${handle}'s party animal just went live 🔑\n\nPowered by Grok + Auth0 Token Vault — the agent retrieved the token, posted the video, and never touched a hardcoded secret.\n\n🎬 ${videoUrl}`,
]

export function buildTweetText(xHandle: string, videoUrl: string) {
  const handle = xHandle.startsWith('@') ? xHandle : `@${xHandle}`
  const template =
    TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)]
  return template(handle, videoUrl)
}

/** Upload a PNG image and return the media_id. */
export async function uploadImageToX(
  token: string,
  imageUrl: string,
): Promise<string> {
  const imageRes = await fetch(imageUrl)
  if (!imageRes.ok) throw new Error('Failed to fetch image for upload')
  const imageBuffer = await imageRes.arrayBuffer()

  // XDK serializes upload body as JSON so it can't carry binary data.
  // Use multipart/form-data directly against the v2 endpoint instead.
  const form = new FormData()
  form.append(
    'media',
    new Blob([imageBuffer], { type: 'image/png' }),
    'image.png',
  )
  form.append('media_category', 'tweet_image')
  form.append('media_type', 'image/png')

  const uploadRes = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    throw new Error(`Image upload failed: ${uploadRes.status} ${body}`)
  }

  const data = await uploadRes.json()
  const mediaId = data?.data?.id as string | undefined
  if (!mediaId) throw new Error('Image upload returned no media id')
  return mediaId
}

/** Upload image (attached as native media) and create the tweet with video URL in text. Returns tweet ID. */
export async function postAnimalToX(
  token: string,
  videoUrl: string,
  xHandle: string,
  imageUrl?: string,
): Promise<string> {
  const client = new Client({ accessToken: token })
  const tweetText = buildTweetText(xHandle, videoUrl)

  let mediaIds: string[] | undefined
  if (imageUrl) {
    try {
      const mediaId = await uploadImageToX(token, imageUrl)
      console.log('[postAnimalToX] Image uploaded, media_id:', mediaId)
      mediaIds = [mediaId]
    } catch (err) {
      console.error(
        '[postAnimalToX] Image upload failed, posting without media:',
        err,
      )
    }
  }

  const response = await client.posts.create({
    text: tweetText,
    ...(mediaIds ? { media: { mediaIds } } : {}),
  })

  const tweetId = response.data?.id as string | undefined
  if (!tweetId) throw new Error('Tweet creation returned no id')
  return tweetId
}
