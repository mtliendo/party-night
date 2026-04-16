import { getAllAnimals } from "@/lib/db";
import WallClient from "./WallClient";

export const revalidate = 30;

export default async function WallPage() {
  const animals = await getAllAnimals();
  return <WallClient animals={animals} />;
}
