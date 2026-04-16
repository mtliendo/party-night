import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login?returnTo=/settings");
  }

  // Check if X is already connected via connected accounts
  const connectedAccounts =
    (session.user["https://party-animals/connected_accounts"] as
      | string[]
      | undefined) ?? [];

  const xConnected = connectedAccounts.includes("twitter");

  return <SettingsClient user={session.user} xConnected={xConnected} />;
}
