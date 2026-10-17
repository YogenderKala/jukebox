import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

export async function createRoom() {
  const { data } = await http.post('/rooms')
  return data // { roomId, hostId, joinUrl }
}

export async function getRoomState(roomId) {
  const { data } = await http.get(`/rooms/${roomId}`)
  return data // { roomId, status, nowPlaying, queue, guestCount }
}

export async function startRoom(roomId) {
  await http.post(`/rooms/${roomId}/start`)
}

export async function endRoom(roomId, hostId) {
  await http.post(`/rooms/${roomId}/end`, null, { headers: { 'X-Host-Id': hostId } })
}

export async function joinRoom(roomId, displayName) {
  const { data } = await http.post(`/rooms/${roomId}/join`, { displayName })
  return data // { guestId, displayName, roomId }
}

export async function searchSongs(query) {
  const { data } = await http.get('/search', { params: { q: query } })
  return data // [{ videoId, title, thumbnail, channelTitle }]
}
