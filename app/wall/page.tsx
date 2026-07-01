import { auth0 } from "@/lib/auth0";
import { getAllAnimals } from "@/lib/db";
import WallClient from "./WallClient";

export const revalidate = 30;

export default async function WallPage() {
  const [animals, session] = await Promise.all([
    getAllAnimals(),
    auth0.getSession(),
  ]);
  return <WallClient animals={animals} isLoggedIn={!!session} />;
}
