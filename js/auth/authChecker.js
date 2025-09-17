import { supabase } from '../db.js'

const storageKey = 'cl_user_meta'
const oauthKey = 'cl_oauth_context'

export const saveUserMeta = (meta) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(meta))
  } catch {}
}

export const getUserMeta = () => {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const requireRole = (allowedRoles) => {
  const meta = getUserMeta()
  if (!meta || !meta.role || (allowedRoles && !allowedRoles.includes(meta.role))) {
    window.location.href = '/login'
  }
}

export const refreshMetaFromSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  const role = session?.user?.user_metadata?.role || null
  const name = session?.user?.user_metadata?.name || null
  if (role || name) {
    saveUserMeta({ role, name })
  }
  return { role, name }
}

export const setOAuthContext = (ctx) => {
  try { localStorage.setItem(oauthKey, JSON.stringify(ctx || {})) } catch {}
}

export const getOAuthContext = () => {
  try {
    const raw = localStorage.getItem(oauthKey)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const clearOAuthContext = () => {
  try { localStorage.removeItem(oauthKey) } catch {}
}

// Global role getter
export const getUserRole = async (options = {}) => {
  const { refresh = false } = options
  if (!refresh) {
    const cached = getUserMeta()
    if (cached && cached.role) return cached.role
  }
  const { data: { session } } = await supabase.auth.getSession()
  const role = session?.user?.user_metadata?.role || null
  const name = session?.user?.user_metadata?.name || null
  if (role || name) saveUserMeta({ role, name })
  return role
}

try {
  // expose globally for anywhere in the app
  window.getUserRole = (opts) => getUserRole(opts)
} catch {}

