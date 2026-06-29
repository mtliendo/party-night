@AGENTS.md

# Party Animal Bot — Project Overview

## What This Is
A conference demo app built for AI World Fair 2026 (San Francisco) that showcases Auth0 Token Vault and AI-powered media generation. Attendees draw an animal on a canvas, enter their GitHub username, and submit. An AI model (Grok) animates the drawing into a short video. The video is stored in Vercel Blob Storage and appears on a public "wall of animals" gallery. As the logged-in admin, I review submissions and approve the good ones — at which point an AI agent uses Auth0 Token Vault to create a GitHub issue in the `focusotter/party-animals-gallery` repo, @-mentioning the attendee.

## Core Demo Narrative
This app demonstrates the Auth0 for AI Agents story:
- **Token Vault** — the GitHub credentials are stored once in Token Vault and retrieved at post time. The agent never holds long-lived credentials.
- **Human-in-the-loop** — I curate submissions before posting, demonstrating that agents act on behalf of users with human approval (complementary to the CIBA pattern).
- **Async agent action** — submission, video generation, and posting are fully decoupled. The attendee gets a success message and walks away; the agent handles the rest.

## User Flow
1. Attendee visits the site on their phone or at the booth
2. Draws an animal on the canvas and enters their GitHub username
3. Hits submit — sees a success screen
4. In the background: canvas is exported as an image → sent to Grok for image-to-video generation → video stored in Vercel Blob → metadata saved to NeonDB
5. Attendee can view the public wall of all submitted animals at any time
6. Admin (me) logs in, reviews pending videos on the wall
7. Admin approves a video → API route retrieves GitHub token from Token Vault → creates a GitHub issue in the gallery repo with the image and video embedded, @-mentioning the attendee

## Tech Stack
- **Frontend** — Next.js (App Router), Tailwind, deployed on Vercel
- **Auth** — Auth0 (`@auth0/nextjs-auth0` v4) for admin login
- **Token Vault** — Auth0 Token Vault storing GitHub credentials for issue posting
- **Database** — NeonDB (Postgres) for video metadata and approval status
- **File Storage** — Vercel Blob for video files
- **AI Video** — Grok image-to-video API
- **GitHub API** — Octokit, creating issues in `focusotter/party-animals-gallery`

## GitHub Issue Format
```
🐾 @[handle]'s Party Animal

![Party Animal by @handle](imageUrl)

🐾 **@handle**'s party animal, brought to life by AI!

🎬 [Watch the animation](videoUrl)

Check out all the animals on [The Wall](wallUrl)

---
_Created at AI World Fair 2026 · Powered by Auth0 Token Vault_
```

## NeonDB Schema (rough)
```sql
animals (
  id          uuid primary key,
  x_handle    text,        -- stores GitHub username (legacy column name)
  image_url   text,        -- Vercel Blob URL of original drawing
  video_url   text,        -- Vercel Blob URL of generated video
  status      text,        -- 'pending' | 'approved' | 'posted'
  tweet_id    text,        -- stores GitHub issue URL (legacy column name)
  created_at  timestamptz
)
```

Note: The DB columns `x_handle` and `tweet_id` retain their original names but now store GitHub usernames and GitHub issue URLs respectively. The TypeScript types alias them as `github_handle` and `issue_url`.

## Key Gotchas
- Token Vault requires `offline.access` scope to generate a refresh token — without it, tokens expire in 2 hours
- Admin login and bot account are completely separate — admin logs in via Auth0, bot account credentials live only in Token Vault
- Grok video generation is async — poll for completion before saving to Blob
- Validate GitHub handles with `GET /users/{login}` before @-mentioning, so a typo doesn't ping a random stranger

## Project Aesthetic

This is a fun game for the AI World Fair conference in San Francisco. As such, it should be fun, vibrant, and aesthetically pleasing. The game GTA6 is a source of inspiration for vibes — not a replica.

## Architecture and Personal Preferences

When it comes to developing with NextJS, I have the following ways I like to develop:

- I like to use server rendered pages that simply fetch any data that needs to be displayed right away, and to simply house the client component. the client component is where the page stuff will live. for example, the page.tsx will have <ClientStuff data={initData}/>. That is just a sample with psuedo code.

- Instead of form actions and data being send directly to the server, I prefer my client components to simply send the data to an API route and have the data acted up there. That's to say, I like my pages to be server rendered, but in spirit, this is to act like a normal SPA with nextjs Api routes doing the data work.

- For the drawing diagram, use the Excalidraw NPM package.
- For agent work in my app, use the ai-sdk and the vercel ai gateway
- for the llm model, use Grok. This will also be the model used for when images become videos. 


- homepage: This page simply tells the user about the app. this is a public page.
- settings page: This is where the user goes to connect their GitHub account so that it can be used as a connected account with auth0 token vault. This page is obviously protected.
- main content page. This is where the user makes their drawing. they have to enter their GitHub username and have a button to post to the animal wall. remember that doing so will also create a GitHub issue in the gallery repo. The video on the wall will be rendered from Vercel Blob storage. this page is protected.

- For turning the image into a video, use Grok imagine: xai/grok-imagine-video

## Helpful Auth0 code samples

Because the `enableConnectedAccounts` in the `lib/auth0.ts` file already mounts several routes automatically, I am able to connect to GitHub using something similar to this code found in another project:

```ts
 <a
                href="/auth/connect?connection=github&returnTo=/settings"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Connect GitHub
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
      connection: 'github'
    })

    const res = await fetch(
      `https://api.github.com/repos/owner/repo/issues/${id}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from GitHub' },
        { status: res.status }
      )
    }
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('GitHub fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from GitHub' },
      { status: 500 }
    )
  }
}
```
