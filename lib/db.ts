import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export type Animal = {
  id: string
  x_handle: string
  image_url: string | null
  video_url: string | null
  status: 'pending' | 'posted'
  tweet_id: string | null
  created_at: string
}

export async function getAllAnimals(): Promise<Animal[]> {
  const rows = await sql`SELECT * FROM animals ORDER BY created_at DESC`
  return rows as Animal[]
}

export async function createAnimal(data: {
  x_handle: string
  image_url?: string
}): Promise<Animal> {
  const rows = await sql`
    INSERT INTO animals (x_handle, image_url)
    VALUES (${data.x_handle}, ${data.image_url ?? null})
    RETURNING *
  `
  return rows[0] as Animal
}

export async function updateAnimal(
  id: string,
  data: Partial<Pick<Animal, 'video_url' | 'status' | 'tweet_id' | 'image_url'>>
): Promise<Animal> {
  const rows = await sql`
    UPDATE animals
    SET
      video_url  = COALESCE(${data.video_url ?? null}, video_url),
      status     = COALESCE(${data.status ?? null}, status),
      tweet_id   = COALESCE(${data.tweet_id ?? null}, tweet_id),
      image_url  = COALESCE(${data.image_url ?? null}, image_url)
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] as Animal
}

export async function getAnimalById(id: string): Promise<Animal | null> {
  const rows = await sql`SELECT * FROM animals WHERE id = ${id}`
  return (rows[0] as Animal) ?? null
}

export { sql }
