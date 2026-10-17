import { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Music2, Wifi, WifiOff, Search, Plus, ThumbsUp, ThumbsDown,
  ListMusic, Radio, Loader2
} from 'lucide-react'
import { loadSession, clearSession } from '../lib/guestSession'
import { searchSongs } from '../lib/api'
import useRoomSocket from '../hooks/useRoomSocket'
import { useEffect } from 'react'

export default function GuestView() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [toast, setToast] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    const s = loadSession(roomId)
    if (!s?.guestId) { navigate(`/join/${roomId}`, { replace: true }); return }
    setSession(s)
  }, [roomId, navigate])

  const [downvotedId, setDownvotedId] = useState(null)

  const { queue, nowPlaying, skipStatus, ended, connected, addSong, vote, downvoteCurrent } = useRoomSocket(
    roomId,
    session?.guestId,
    { onError: (e) => showToast(e.message, 'error') }
  )

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function runSearch() {
    const q = query.trim()
    if (!q) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    setResults([])
    searchSongs(q)
      .then((data) => { if (!ctrl.signal.aborted) setResults(data) })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setSearching(false) })
  }

  const handleAdd = useCallback((song) => {
    addSong(song)
    setQuery('')
    setResults([])
    showToast(`Added "${song.title}"`, 'success')
  }, [addSong])

  const handleVote = useCallback((videoId, dir) => vote(videoId, dir), [vote])

  const handleDownvoteCurrent = useCallback(() => {
    if (!nowPlaying?.videoId) return
    downvoteCurrent(nowPlaying.videoId)
    setDownvotedId(nowPlaying.videoId)
  }, [downvoteCurrent, nowPlaying])

  if (!session) return null

  if (ended) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 animate-fade-in">
        <div className="card-accent w-full max-w-sm flex flex-col items-center gap-3 text-center animate-scale-in">
          <Music2 className="w-14 h-14" strokeWidth={1.5} />
          <h2 className="font-display text-3xl">The party's over</h2>
          <p className="text-sm text-ink/70 leading-relaxed">
            {ended.reason === 'EXPIRED'
              ? 'This room expired after sitting idle.'
              : 'The host has closed this room. Thanks for joining!'}
          </p>
          <button
            onClick={() => { clearSession(roomId); navigate('/host') }}
            className="btn-secondary w-full mt-2"
          >
            Back to start
          </button>
        </div>
      </div>
    )
  }

  const hasDownvoted = downvotedId === nowPlaying?.videoId
  const skip = skipStatus?.videoId === nowPlaying?.videoId ? skipStatus : null

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 pb-10">
      {toast && <Toast toast={toast} />}

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-ink flex items-center justify-between py-3.5 -mx-4 px-4 animate-slide-down">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent border-2 border-ink flex items-center justify-center">
            <Music2 className="w-3.5 h-3.5 text-ink" />
          </div>
          <div>
            <p className="font-display text-base text-ink leading-none">Pub Jukebox</p>
            <p className="text-[11px] text-muted mt-0.5">
              <span className="text-ink font-medium">{session.displayName}</span>
              {' · '}
              <span className="font-mono text-muted">{roomId}</span>
            </p>
          </div>
        </div>

        <div className={connected ? 'badge-live' : 'badge-offline'}>
          {connected
            ? <><span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse-dot" />&nbsp;Live</>
            : <><WifiOff className="w-3 h-3" />&nbsp;Offline</>
          }
        </div>
      </header>

      <div className="flex flex-col gap-4 mt-5">

        {/* ── Now Playing ────────────────────────────────────── */}
        {nowPlaying && !nowPlaying.empty && (
          <div className="card-accent flex items-center gap-3 animate-scale-in">
            {nowPlaying.thumbnail
              ? <img src={nowPlaying.thumbnail} alt="" className="w-14 h-10 rounded-lg object-cover shrink-0" />
              : <div className="w-14 h-10 rounded-lg bg-ink/10 flex items-center justify-center shrink-0"><Radio className="w-4 h-4 text-muted" /></div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink font-semibold uppercase tracking-widest">Now Playing</p>
              <p className="text-sm font-medium text-ink truncate mt-0.5">{nowPlaying.title}</p>
            </div>
            <button
              onClick={handleDownvoteCurrent}
              disabled={!connected || hasDownvoted}
              title={hasDownvoted ? 'You downvoted this song' : 'Downvote — skip if the majority agrees'}
              className={`flex flex-col items-center gap-0.5 shrink-0 px-2.5 py-1.5 rounded-xl border-2 border-ink transition-all disabled:cursor-not-allowed ${
                hasDownvoted
                  ? 'bg-ink text-accent'
                  : 'bg-surface text-ink hover:-translate-y-0.5 hover:shadow-brutal active:translate-y-0 active:shadow-none disabled:opacity-40'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              {skip && (
                <span className="text-[10px] font-bold tabular-nums leading-none">
                  {skip.votes}/{skip.required}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── Search ─────────────────────────────────────────── */}
        <div className="card animate-fade-in">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Search className="w-3 h-3" /> Search
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Song or artist name…"
              className="input-base flex-1"
            />
            <button onClick={runSearch} disabled={searching} className="btn-secondary shrink-0 px-3">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {searching && (
            <div className="flex items-center gap-2 mt-3 text-muted text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching…
            </div>
          )}

          {results.length > 0 && (
            <ul className="mt-3 space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
              {results.map((song) => (
                <li key={song.videoId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/30 transition-colors group animate-fade-in">
                  {song.thumbnail
                    ? <img src={song.thumbnail} alt="" className="w-12 h-9 rounded-md object-cover shrink-0" />
                    : <div className="w-12 h-9 rounded-md bg-ink/10 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{song.title}</p>
                    <p className="text-xs text-muted truncate">{song.channelTitle}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(song)}
                    disabled={!connected}
                    className="btn-secondary py-1.5 px-2.5 shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!connected && results.length > 0 && (
            <p className="text-xs text-muted text-center mt-2">Connect to the room to add songs</p>
          )}
        </div>

        {/* ── Queue ──────────────────────────────────────────── */}
        <div className="card animate-fade-in">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <ListMusic className="w-3 h-3" />
            Queue
            <span className="text-muted font-normal ml-0.5 normal-case tracking-normal">({queue.length})</span>
          </p>

          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted">
              <ListMusic className="w-8 h-8 opacity-30" />
              <p className="text-sm">No songs queued yet</p>
              <p className="text-xs text-muted/60">Be the first to add something!</p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {queue.map((item, i) => (
                <li key={item.videoId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/30 transition-colors">
                  <span className="text-muted/60 text-xs w-4 text-center font-mono shrink-0 tabular-nums">{i + 1}</span>
                  {item.thumbnail
                    ? <img src={item.thumbnail} alt="" className="w-10 h-7 rounded-md object-cover shrink-0" />
                    : <div className="w-10 h-7 rounded-md bg-ink/10 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                    <p className="text-xs text-muted truncate">by {item.addedBy}</p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <button onClick={() => handleVote(item.videoId, 1)} className="p-1 text-muted hover:text-ink transition-colors rounded">
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-muted tabular-nums leading-none">{Math.round(item.score)}</span>
                    <button onClick={() => handleVote(item.videoId, -1)} className="p-1 text-muted hover:text-ink transition-colors rounded">
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}

function Toast({ toast }) {
  const styles = {
    error:   'bg-red-100 border-red-700 text-red-700',
    success: 'bg-accent border-ink text-ink',
    info:    'bg-surface border-ink text-ink',
  }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-brutal border-2 text-sm font-medium whitespace-nowrap animate-slide-down ${styles[toast.type] ?? styles.info}`}>
      {toast.msg}
    </div>
  )
}
