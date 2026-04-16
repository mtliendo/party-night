import { auth0 } from '@/lib/auth0'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect('/auth/login?returnTo=/settings')
  }

  async function checkXConnected() {
    try {
      const { token } = await auth0.getAccessTokenForConnection({
        connection: 'twitter',
      })
      console.log(token)
      return true
    } catch {
      return false
    }
  }

  const xConnected = await checkXConnected()

  return <SettingsClient user={session.user} xConnected={xConnected} />
}
