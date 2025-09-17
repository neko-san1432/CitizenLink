import { supabase } from '../db.js'
import { saveUserMeta, setOAuthContext, clearOAuthContext } from '../auth/authChecker.js'

const run = async () => {
  // After OAuth or email confirmation, Supabase sets a session
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  const accessToken = session?.access_token || null
  const role = user?.user_metadata?.role || null
  const name = user?.user_metadata?.name || null
  const email = user?.email || null

  if (role || name) saveUserMeta({ role, name })

  // Track provider
  const provider = user?.identities?.[0]?.provider || null
  if (provider) {
    setOAuthContext({ provider, email })
    // merge into oauth_providers array
    try {
      const currentProviders = Array.isArray(user?.user_metadata?.oauth_providers)
        ? user.user_metadata.oauth_providers
        : []
      const nextProviders = Array.from(new Set([...currentProviders, provider]))
      await supabase.auth.updateUser({ data: { oauth_providers: nextProviders } })
    } catch {}
  }
  // Persist access token to HttpOnly cookie for server-protected pages
  try {
    if (accessToken) {
      await fetch('/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      })
    }
  } catch {}

  // redirect based on registration status
  if (provider && !user?.user_metadata?.mobile) {
    // OAuth user needs to complete registration (no phone number)
    window.location.href = '/oauth-continuation'
  } else {
    // Regular user or OAuth user with complete profile (has phone number)
    window.location.href = '/dashboard'
  }
}

run()


