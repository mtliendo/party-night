import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export type Animal = {
  id: string
  github_handle: string
  image_url: string | null
  video_url: string | null
  status: 'pending' | 'approved' | 'posted'
  issue_url: string | null
  created_at: string
}

export async function getAllAnimals(): Promise<Animal[]> {
  const rows = await sql`
    SELECT id, x_handle AS github_handle, image_url, video_url, status,
           tweet_id AS issue_url, created_at
    FROM animals ORDER BY created_at DESC
  `
  return rows as Animal[]
}

export async function createAnimal(data: {
  github_handle: string
  image_url?: string
}): Promise<Animal> {
  const rows = await sql`
    INSERT INTO animals (x_handle, image_url)
    VALUES (${data.github_handle}, ${data.image_url ?? null})
    RETURNING id, x_handle AS github_handle, image_url, video_url, status,
              tweet_id AS issue_url, created_at
  `
  return rows[0] as Animal
}

export async function updateAnimal(
  id: string,
  data: Partial<Pick<Animal, 'video_url' | 'status' | 'issue_url' | 'image_url'>>
): Promise<Animal> {
  const rows = await sql`
    UPDATE animals
    SET
      video_url  = COALESCE(${data.video_url ?? null}, video_url),
      status     = COALESCE(${data.status ?? null}, status),
      tweet_id   = COALESCE(${data.issue_url ?? null}, tweet_id),
      image_url  = COALESCE(${data.image_url ?? null}, image_url)
    WHERE id = ${id}
    RETURNING id, x_handle AS github_handle, image_url, video_url, status,
              tweet_id AS issue_url, created_at
  `
  return rows[0] as Animal
}

export async function getAnimalById(id: string): Promise<Animal | null> {
  const rows = await sql`
    SELECT id, x_handle AS github_handle, image_url, video_url, status,
           tweet_id AS issue_url, created_at
    FROM animals WHERE id = ${id}
  `
  return (rows[0] as Animal) ?? null
}

export async function deleteAnimal(id: string): Promise<void> {
  await sql`DELETE FROM animals WHERE id = ${id}`
}

export { sql }
