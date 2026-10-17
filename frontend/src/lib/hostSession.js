const KEY = 'pj_host_session'

export function saveHostSession({ roomId, hostId, joinUrl, hostGuestId, started = false }) {
  localStorage.setItem(KEY, JSON.stringify({ roomId, hostId, joinUrl, hostGuestId, started }))
}

export function loadHostSession() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function markHostStarted() {
  const s = loadHostSession()
  if (s) localStorage.setItem(KEY, JSON.stringify({ ...s, started: true }))
}

export function clearHostSession() {
  localStorage.removeItem(KEY)
}
