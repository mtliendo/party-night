import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { createAnimal, getAllAnimals, updateAnimal } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { auth0 } from '@/lib/auth0'
import { createAnimalIssue } from '@/lib/github-post'

export async function GET() {
  try {
    const animals = await getAllAnimals()
    return NextResponse.json(animals)
  } catch (err) {
    console.error('[GET /api/animals]', err)
    return NextResponse.json(
      { error: 'Failed to fetch animals' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const githubHandle = formData.get('githubHandle') as string | null

    if (!imageFile || !githubHandle) {
      return NextResponse.json(
        { error: 'Missing image or GitHub handle' },
        { status: 400 },
      )
    }

    // 1. Upload original drawing to Vercel Blob
    const imageId = uuidv4()
    const imageBuffer = await imageFile.arrayBuffer()
    const imageBlob = await put(`animals/${imageId}/drawing.png`, imageBuffer, {
      access: 'public',
      token: process.env.PARTY_ANIMAL_BLOB_READ_WRITE_TOKEN,
      contentType: 'image/png',
    })

    // 2. Save initial record to DB
    const animal = await createAnimal({
      github_handle: githubHandle.startsWith('@')
        ? githubHandle
        : `@${githubHandle}`,
      image_url: imageBlob.url,
    })

    // 3. Grab the GitHub token from Auth0 Token Vault while the session is active.
    let githubToken: string | null = null
    try {
      const { token } = await auth0.getAccessTokenForConnection({
        connection: 'github',
      })
      githubToken = token
    } catch (err) {
      console.warn(
        '[POST /api/animals] Could not get GitHub token — issue post skipped:',
        err,
      )
    }

    // 4. Kick off video generation async (don't await — respond fast)
    void generateAndSaveVideo(
      animal.id,
      imageBlob.url,
      animal.github_handle,
      githubToken,
    ).catch((err) => console.error('[generateAndSaveVideo]', err))

    return NextResponse.json(animal, { status: 201 })
  } catch (err) {
    console.error('[POST /api/animals]', err)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}

async function generateAndSaveVideo(
  animalId: string,
  imageUrl: string,
  githubHandle: string,
  githubToken: string | null,
) {
  const xaiBase = 'https://api.x.ai/v1'
  const apiKey = process.env.XAI_API_KEY!

  // Fetch the image from Vercel Blob and convert to base64 data URL
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`)
  const imgBuffer = await imgRes.arrayBuffer()
  const base64 = Buffer.from(imgBuffer).toString('base64')
  const mimeType = imgRes.headers.get('content-type') ?? 'image/png'
  const dataUrl = `data:${mimeType};base64,${base64}`

  // Initiate video generation
  const initRes = await fetch(`${xaiBase}/videos/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-video',
      prompt:
        'Animate this party animal drawing — make it fun and bouncy but keep many of the details of the drawing. If the drawing includes text, use that as additional context for the animation but do not include that text in the resulting video.',
      duration: 5,
      resolution: '480p',
      image: { url: dataUrl },
    }),
  })

  if (!initRes.ok) {
    const text = await initRes.text()
    throw new Error(`Video generation init failed: ${initRes.status} ${text}`)
  }

  const initData = await initRes.json()

  // x.ai returns request_id for polling
  const requestId: string = initData.request_id
  if (!requestId) {
    throw new Error(
      `No request_id returned from video API: ${JSON.stringify(initData)}`,
    )
  }

  // 4. Poll until complete (max 3 min, every 5s)
  let videoUrl: string | null = null
  const maxAttempts = 36

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000)

    const pollRes = await fetch(`${xaiBase}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!pollRes.ok) continue

    const pollData = await pollRes.json()
    const status: string = pollData.status ?? pollData.state ?? 'processing'

    if (status === 'done') {
      videoUrl = pollData.video?.url ?? pollData.video_url ?? pollData.url
      break
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(`Video generation failed: ${JSON.stringify(pollData)}`)
    }
  }

  if (!videoUrl) {
    throw new Error('Video generation timed out')
  }

  // 5. Download video and re-upload to Vercel Blob
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error('Failed to download generated video')

  const videoBuffer = await videoRes.arrayBuffer()
  const stored = await put(`animals/${animalId}/video.mp4`, videoBuffer, {
    access: 'public',
    token: process.env.PARTY_ANIMAL_BLOB_READ_WRITE_TOKEN,
    contentType: 'video/mp4',
  })

  // 6. Update DB record
  await updateAnimal(animalId, { video_url: stored.url, status: 'approved' })

  // 7. Post to GitHub as an issue
  if (!githubToken) {
    console.warn(
      '[generateAndSaveVideo] Missing GitHub token — created video but skipped GitHub posting:',
      { animalId },
    )
    return
  }

  try {
    const issue = await createAnimalIssue({
      token: githubToken,
      githubHandle,
      imageUrl,
      videoUrl: stored.url,
    })
    await updateAnimal(animalId, { status: 'posted', issue_url: issue.url })
  } catch (err) {
    console.error('[generateAndSaveVideo] createAnimalIssue failed:', err)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
