import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import DrawClient from "./DrawClient";

export default async function DrawPage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login?returnTo=/draw");
  }

  return <DrawClient />;
}
