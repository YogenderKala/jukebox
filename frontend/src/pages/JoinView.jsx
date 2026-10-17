import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Music2, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { joinRoom } from '../lib/api'
import { loadSession, saveSession } from '../lib/guestSession'

export default function JoinView() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const session = loadSession(roomId)
    if (session?.guestId) navigate(`/guest/${roomId}`, { replace: true })
  }, [roomId, navigate])

  async function handleJoin(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await joinRoom(roomId, name.trim())
      saveSession(roomId, data.guestId, data.displayName)
      navigate(`/guest/${roomId}`, { replace: true })
    } catch (err) {
      setError(err.response?.status === 404 ? 'Room not found. Check the code and try again.' : 'Failed to join — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 animate-fade-in">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-lg bg-accent border-2 border-ink shadow-brutal flex items-center justify-center">
          <Music2 className="w-4 h-4 text-ink" />
        </div>
        <span className="font-display text-2xl text-ink">Pub Jukebox</span>
      </div>

      {/* Card */}
      <div className="card-accent w-full max-w-sm animate-scale-in">
        <div className="mb-5">
          <h2 className="font-display text-3xl text-ink">Join the room</h2>
          <p className="text-sm text-muted mt-1">
            Room&nbsp;
            <span className="font-mono font-bold text-ink tracking-widest">{roomId}</span>
            &nbsp;is waiting for you.
          </p>
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-ink block mb-1.5">Your display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={30}
              className="input-base"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-100 border-2 border-red-700 rounded-xl px-3 py-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary w-full py-3 mt-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? 'Joining…' : 'Join Room'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-muted">Your name is visible to everyone in the room.</p>
    </div>
  )
}
