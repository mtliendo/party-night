@AGENTS.md

# Party Animal Bot — Project Overview

## What This Is
A conference demo app built for React Miami that showcases Auth0 Token Vault and AI-powered media generation. Attendees draw an animal on a canvas, enter their X (Twitter) handle, and submit. An AI model (Grok) animates the drawing into a short video. The video is stored in Vercel Blob Storage and appears on a public "wall of animals" gallery. As the logged-in admin, I review submissions and approve the good ones — at which point an AI agent uses Auth0 Token Vault to post the video natively to X from the bot account @PartyAnimalBot, tagging the attendee, @auth0, and @ReactMiami.

The physical hook: attendees receive a limited 3D-printed NFC tag (X logo on the front, Auth0 logo on the back) as a reward for submitting their animal.

## Core Demo Narrative
This app demonstrates the Auth0 for AI Agents story:
- **Token Vault** — the bot account's X credentials are stored once in Token Vault and retrieved at post time. The agent never holds long-lived credentials.
- **Human-in-the-loop** — I curate submissions before posting, demonstrating that agents act on behalf of users with human approval (complementary to the CIBA pattern).
- **Async agent action** — submission, video generation, and posting are fully decoupled. The attendee gets a success message and walks away; the agent handles the rest.

## User Flow
1. Attendee visits the site on their phone or at the booth
2. Draws an animal on the canvas and enters their X handle
3. Hits submit — sees a success screen
4. In the background: canvas is exported as an image → sent to Grok for image-to-video generation → video stored in Vercel Blob → metadata saved to NeonDB
5. Attendee can view the public wall of all submitted animals at any time
6. Admin (me) logs in, reviews pending videos on the wall
7. Admin approves a video → Lambda/API route retrieves bot's X token from Token Vault → uploads video natively to X via chunked media upload (INIT/APPEND/FINALIZE) → creates post tagging attendee, @auth0, @ReactMiami

## Tech Stack
- **Frontend** — Next.js (App Router), Tailwind, deployed on Vercel
- **Auth** — Auth0 (`@auth0/nextjs-auth0` v4) for admin login
- **Token Vault** — Auth0 Token Vault storing @PartyAnimalBot's X credentials
- **Database** — NeonDB (Postgres) for video metadata and approval status
- **File Storage** — Vercel Blob for video files
- **AI Video** — Grok image-to-video API
- **X API** — v2, pay-per-use, OAuth 2.0 user context

## X API Scopes Required (bot account)
- `tweet.write`
- `tweet.read`
- `users.read`
- `media.write`
- `offline.access` ← required for Token Vault refresh token storage

## Video Posting Flow (X API)
Video posting is a multi-step process:
1. INIT — register upload with X, get `media_id`
2. APPEND — upload video in chunks (max 1MB each)
3. FINALIZE — signal upload complete, poll for processing status
4. POST — create tweet with `media_id` attached and tweet text

## Tweet Format
```
🎉 Meet @[handle]'s party animal, brought to life by AI!

Check out all the animals → [wall URL]

@auth0 @ReactMiami
```

## NeonDB Schema (rough)
```sql
animals (
  id          uuid primary key,
  x_handle    text,
  image_url   text,        -- Vercel Blob URL of original drawing
  video_url   text,        -- Vercel Blob URL of generated video
  status      text,        -- 'pending' | 'approved' | 'posted'
  tweet_id    text,        -- populated after posting
  created_at  timestamptz
)
```

## Key Gotchas
- `media.write` scope is easy to forget and causes silent 403s on upload
- Token Vault requires `offline.access` scope to generate a refresh token — without it, tokens expire in 2 hours
- X video upload is chunked (INIT/APPEND/FINALIZE) — not a single API call
- Admin login and bot account are completely separate — admin logs in via Auth0, bot account credentials live only in Token Vault
- Grok video generation is async — poll for completion before saving to Blob

## Project Aestetic

This is a fun game for the React Miami conference. As such, it should be fun, vibrant, and aestetically pleasing. For reference, this is the React Miami website: https://www.reactmiami.com/. In addition, the game GTA6 is also a source of inspiration. I'm not looking for a replica, but rather, I'm looking for vibes.

## Architecture and Personal Preferences

When it comes to developing with NextJS, I have the following ways I like to develop:

- I like to use server rendered pages that simply fetch any data that needs to be displayed right away, and to simply house the client component. the client component is where the page stuff will live. for example, the page.tsx will have <ClientStuff data={initData}/>. That is just a sample with psuedo code.

- Instead of form actions and data being send directly to the server, I prefer my client components to simply send the data to an API route and have the data acted up there. That's to say, I like my pages to be server rendered, but in spirit, this is to act like a normal SPA with nextjs Api routes doing the data work.

- For the drawing diagram, use the Excalidraw NPM package.
- For agent work in my app, use the ai-sdk and the vercel ai gateway
- for the llm model, use Grok. This will also be the model used for when images become videos. 


- homepage: This page simply tells the user about the app. this is a public page.
- settings page: This is where the user goes to connect their account to X so that it can be used as a connected account with auth0 token vault. This page is obviously protected.
- main content page. This is where the user makes their drawing. they have to enter their X handle and have a button to post to the animal wall. remember that doing so will also send it to my X account using the X message I layed out above. The video on X will be an X original video, while the video on the animal wall will be rendered from Vercel Blob storage. this page is protected.

- For turning the image into a video, use Grok imagine: xai/grok-imagine-video

## Helpful Auth0 code samples

Because the `enableConnectedAccounts` in the `lib/auth0.ts` file already mounts several routes automatically, I am able to connect to X using something similar to this code found in another project:

```ts
 <a
                href="/auth/connect?connection=google-oauth2&returnTo=/settings"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Connect Google Drive
              </a>
```

Additionally, I was able to connect and make external calls using code like this:
```ts
import { auth0 } from '@/lib/auth0'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { token } = await auth0.getAccessTokenForConnection({
      connection: 'google-oauth2'
    })

    // Fetch the actual file bytes from Google Drive
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )

    if (!res.ok) {
      const errorText = await res.text()
      console.log('[v0] Google Drive file fetch failed:', res.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch file from Google Drive' },
        { status: res.status }
      )
    }
    
    console.log('[v0] Successfully fetched file, streaming response')

    // Get the content type from the response
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    
    // Stream the file bytes through
    const blob = await res.blob()
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Google Drive file fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch file from Google Drive' },
      { status: 500 }
    )
  }
}
```