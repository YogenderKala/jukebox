const PREFIX = 'pj_guest_'

export function saveSession(roomId, guestId, displayName) {
  localStorage.setItem(PREFIX + roomId, JSON.stringify({ guestId, displayName }))
}

export function loadSession(roomId) {
  try {
    const raw = localStorage.getItem(PREFIX + roomId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession(roomId) {
  localStorage.removeItem(PREFIX + roomId)
}
