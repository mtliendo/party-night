import { auth0 } from '@/lib/auth0'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect('/auth/login?returnTo=/settings')
  }

  async function checkGitHubConnected() {
    try {
      await auth0.getAccessTokenForConnection({
        connection: 'github',
      })
      return true
    } catch {
      return false
    }
  }

  const githubConnected = await checkGitHubConnected()

  return <SettingsClient user={session.user} githubConnected={githubConnected} userId={session.user.sub as string} />
}
