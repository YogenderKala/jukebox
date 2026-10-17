import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import YouTube from 'react-youtube'
import { QRCodeSVG } from 'qrcode.react'
import {
  Music2, Users, Play, SkipForward, Search, Plus, ListMusic,
  QrCode, LogOut, Loader2, Radio, Wifi, WifiOff, ChevronRight,
  AlertCircle, CheckCircle, RotateCcw, ThumbsDown
} from 'lucide-react'
import { createRoom, startRoom, endRoom, searchSongs, getRoomState } from '../lib/api'
import { saveHostSession, loadHostSession, markHostStarted, clearHostSession } from '../lib/hostSession'
import useRoomSocket from '../hooks/useRoomSocket'
import Card from '../components/Card'
import ConfirmDialog from '../components/ConfirmDialog'

export default function HostView() {
  const navigate = useNavigate()

  // Landing state
  const [joinCode, setJoinCode]           = useState('')
  const [creating, setCreating]           = useState(false)
  const [savedSession, setSavedSession]   = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // Room state
  const [room, setRoom]           = useState(null)
  const [hostGuestId, setHostGuestId] = useState(null)
  const [started, setStarted]     = useState(false)
  const [starting, setStarting]   = useState(false)
  const [toast, setToast]         = useState(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding]       = useState(false)
  const endingRef = useRef(false)

  // Search
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const abortRef = useRef(null)

  // ── Session check on mount ─────────────────────────────────
  useEffect(() => {
    const saved = loadHostSession()
    if (!saved) { setCheckingSession(false); return }
    getRoomState(saved.roomId)
      .then(() => { setSavedSession(saved); setCheckingSession(false) })
      .catch(() => { clearHostSession(); setCheckingSession(false) })
  }, [])

  const { queue, nowPlaying, skipStatus, ended, connected, addSong, next, playNow } = useRoomSocket(
    room?.roomId,
    hostGuestId,
    { onError: (e) => showToast(e.message, 'error') }
  )

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Handlers ───────────────────────────────────────────────
  async function handleCreateRoom() {
    setCreating(true)
    try {
      clearHostSession()
      const data = await createRoom()
      const hgId = 'host-' + data.hostId
      saveHostSession({ ...data, hostGuestId: hgId, started: false })
      setHostGuestId(hgId)
      setRoom(data)
      setSavedSession(null)
    } catch {
      showToast('Failed to create room — is the backend running?', 'error')
    } finally {
      setCreating(false)
    }
  }

  function handleContinueSession() {
    setHostGuestId(savedSession.hostGuestId)
    setRoom({ roomId: savedSession.roomId, hostId: savedSession.hostId, joinUrl: savedSession.joinUrl })
    setStarted(savedSession.started)
    setSavedSession(null)
  }

  function handleDiscardSession() {
    clearHostSession()
    setSavedSession(null)
  }

  function handleJoinExisting() {
    const code = joinCode.trim().toUpperCase()
    if (code.length >= 3) navigate(`/join/${code}`)
  }

  async function handleStart() {
    setStarting(true)
    try {
      await startRoom(room.roomId)
      setStarted(true)
      markHostStarted()
      showToast('Room is live!', 'success')
    } catch (err) {
      if (err.response?.status === 404) {
        showToast('Room expired — create a new one.', 'error')
        clearHostSession(); setRoom(null)
      } else {
        showToast('Failed to start — check backend.', 'error')
      }
    } finally {
      setStarting(false)
    }
  }

  function resetRoom() {
    clearHostSession()
    setRoom(null); setHostGuestId(null); setStarted(false)
    setQuery(''); setResults([])
  }

  // Room closed from elsewhere (idle expiry, or ended from another tab)
  useEffect(() => {
    if (!ended || !room || endingRef.current) return
    resetRoom()
    showToast(ended.reason === 'EXPIRED' ? 'The room expired after sitting idle.' : 'This party has ended.')
  }, [ended]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirmEnd() {
    setEnding(true)
    endingRef.current = true
    try {
      await endRoom(room.roomId, room.hostId)
    } catch (err) {
      const status = err.response?.status
      if (status !== 404) {
        // 404 means the room is already gone, which is the outcome we wanted
        endingRef.current = false
        setEnding(false)
        setConfirmEnd(false)
        showToast(status === 403 ? 'Only the host can end this party.' : 'Could not end the party — is the backend running?', 'error')
        return
      }
    }
    resetRoom()
    setEnding(false)
    setConfirmEnd(false)
    endingRef.current = false
    showToast('Party ended. The room has been closed.', 'success')
  }

  function runSearch() {
    const q = query.trim()
    if (!q) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true); setResults([])
    searchSongs(q)
      .then((d) => { if (!ctrl.signal.aborted) setResults(d) })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setSearching(false) })
  }

  const handleAdd = useCallback((song) => {
    addSong(song); setQuery(''); setResults([])
    showToast(`"${song.title}" added to queue`, 'success')
  }, [addSong])

  const handleSkip = useCallback(() => next(), [next])
  const handleEnd  = useCallback(() => next(), [next])
  const handlePlayNow = useCallback((item) => {
    playNow(item.videoId)
    showToast(`Playing "${item.title}"`, 'success')
  }, [playNow])

  // ── Loading ────────────────────────────────────────────────
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    )
  }

  // ── Landing ────────────────────────────────────────────────
  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-16 animate-fade-in">
        {toast && <Toast toast={toast} />}

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent border-2 border-ink shadow-brutal flex items-center justify-center">
            <Music2 className="w-6 h-6 text-ink" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-5xl text-ink">Pub Jukebox</h1>
            <p className="text-sm text-muted mt-1">Let the crowd curate the night.</p>
          </div>
        </div>

        {/* Resume banner */}
        {savedSession && (
          <div className="w-full max-w-md animate-slide-down">
            <div className="flex items-center gap-3 bg-accent/30 border border-ink rounded-xl px-4 py-3">
              <Radio className="w-4 h-4 text-ink shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">Session in progress</p>
                <p className="text-xs text-muted mt-0.5">
                  Room <span className="font-mono text-ink">{savedSession.roomId}</span>
                  {savedSession.started ? ' · Live' : ' · Not started'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleContinueSession} className="btn-secondary text-xs py-1.5 px-3">
                  <RotateCcw className="w-3 h-3" /> Resume
                </button>
                <button onClick={handleDiscardSession} className="btn-ghost text-xs py-1.5 px-2">
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Option cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">

          <Card
            eyebrow="Host"
            title="Start a Room"
            description="Create a room, share the QR, and let guests add songs."
            icon={Music2}
            onClick={handleCreateRoom}
            loading={creating}
          />

          <Card
            eyebrow="Guest"
            title="Join a Room"
            description="Enter the room code shown on the host's screen."
            icon={Users}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinExisting()}
              placeholder="ABCDE"
              maxLength={5}
              className="input-base font-mono text-center text-xl tracking-[0.4em] uppercase"
            />
            <button
              onClick={handleJoinExisting}
              disabled={joinCode.trim().length < 3}
              className="btn-secondary mt-auto"
            >
              <ChevronRight className="w-4 h-4" /> Join Room
            </button>
          </Card>

        </div>
      </div>
    )
  }

  // ── Active Room ────────────────────────────────────────────
  const statusBadge = !connected
    ? <span className="badge-offline"><WifiOff className="w-3 h-3" />&nbsp;Connecting…</span>
    : started
      ? <span className="badge-live"><span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse-dot" />&nbsp;Live</span>
      : <span className="badge-ready"><Wifi className="w-3 h-3" />&nbsp;Ready</span>

  return (
    <div className="min-h-screen flex flex-col">
      {toast && <Toast toast={toast} />}

      {confirmEnd && (
        <ConfirmDialog
          title="End the party?"
          message="This closes the room for everyone. Guests will be disconnected, and the queue and room code will be deleted. This can't be undone."
          confirmLabel="End party"
          busy={ending}
          onConfirm={handleConfirmEnd}
          onCancel={() => setConfirmEnd(false)}
        />
      )}

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm border-b border-ink px-5 py-3 flex items-center justify-between animate-slide-down">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent border-2 border-ink flex items-center justify-center">
              <Music2 className="w-3.5 h-3.5 text-ink" />
            </div>
            <span className="font-display text-base text-ink">Pub Jukebox</span>
          </div>
          <span className="text-muted/60">·</span>
          <span className="font-mono font-bold text-ink tracking-widest text-sm">{room.roomId}</span>
          {statusBadge}
        </div>
        <button onClick={() => setConfirmEnd(true)} className="btn-danger text-xs">
          <LogOut className="w-3.5 h-3.5" /> End Party
        </button>
      </header>

      {/* ── Main layout ──────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 p-5 max-w-7xl mx-auto w-full">

        {/* Left sidebar: QR + controls (2/5) */}
        <aside className="lg:col-span-2 flex flex-col gap-4">

          {/* QR card */}
          <div className="card flex flex-col items-center gap-4 animate-fade-in">
            <div className="flex items-center gap-1.5 self-start w-full mb-1">
              <QrCode className="w-3.5 h-3.5 text-muted" />
              <span className="text-xs font-semibold text-muted uppercase tracking-widest">Invite guests</span>
            </div>
            <div className="bg-white p-3 rounded-xl border-2 border-ink">
              <QRCodeSVG value={room.joinUrl} size={156} />
            </div>
            <div className="text-center">
              <p className="font-mono font-bold text-ink text-2xl tracking-[0.3em]">{room.roomId}</p>
              <p className="text-xs text-muted mt-1 break-all">{room.joinUrl}</p>
            </div>

            {!started ? (
              <button onClick={handleStart} disabled={starting} className="btn-primary w-full py-3">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {starting ? 'Starting…' : 'Start the Party'}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink font-medium">
                <CheckCircle className="w-4 h-4" />
                Room is live
              </div>
            )}
          </div>

          {/* Now playing panel */}
          {nowPlaying && !nowPlaying.empty && (
            <div className="card-accent flex items-start justify-between gap-3 animate-scale-in">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {nowPlaying.thumbnail
                  ? <img src={nowPlaying.thumbnail} alt="" className="w-14 h-10 rounded-lg object-cover shrink-0" />
                  : <div className="w-14 h-10 rounded-lg bg-ink/10 flex items-center justify-center shrink-0"><Radio className="w-4 h-4 text-muted" /></div>
                }
                <div className="min-w-0">
                  <p className="text-[11px] text-ink font-semibold uppercase tracking-widest">Now Playing</p>
                  <p className="text-sm font-medium text-ink truncate mt-0.5">{nowPlaying.title}</p>
                  {skipStatus?.videoId === nowPlaying.videoId && skipStatus.votes > 0 && (
                    <p className="text-[11px] font-bold text-ink mt-0.5 flex items-center gap-1">
                      <ThumbsDown className="w-3 h-3" />
                      {skipStatus.votes}/{skipStatus.required} downvotes to skip
                    </p>
                  )}
                </div>
              </div>
              <button onClick={handleSkip} title="Skip song" className="btn-secondary py-1.5 px-2 shrink-0">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Guest count hint */}
          <div className="flex items-center gap-2 px-1">
            <Users className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs text-muted">{queue.length} song{queue.length !== 1 ? 's' : ''} in queue</span>
          </div>
        </aside>

        {/* Right main: player + search + queue (3/5) */}
        <main className="lg:col-span-3 flex flex-col gap-4">

          {/* YouTube player */}
          {started && nowPlaying && !nowPlaying.empty && (
            <div className="card p-0 overflow-hidden animate-scale-in aspect-video">
              <YouTube
                videoId={nowPlaying.videoId}
                opts={{ height: '100%', width: '100%', playerVars: { autoplay: 1, modestbranding: 1, rel: 0 } }}
                onEnd={handleEnd}
                onError={handleEnd}
                className="w-full h-full"
                iframeClassName="w-full h-full"
              />
            </div>
          )}

          {/* Search */}
          <div className="card animate-fade-in">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Search className="w-3 h-3" /> Add a Song
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="Search YouTube… press Enter"
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
              <ul className="mt-3 space-y-1 max-h-60 overflow-y-auto -mx-1 px-1">
                {results.map((song) => (
                  <li key={song.videoId}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/30 transition-colors group animate-fade-in">
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
                      className="btn-primary py-1.5 px-3 shrink-0 text-xs opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Queue */}
          <div className="card animate-fade-in">
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <ListMusic className="w-3 h-3" />
              Queue
              <span className="text-muted font-normal normal-case tracking-normal ml-0.5">({queue.length})</span>
            </p>

            {queue.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted/60">
                <ListMusic className="w-8 h-8 opacity-30" />
                <p className="text-sm">Queue is empty</p>
                <p className="text-xs text-muted/60">Search above or wait for guests to add songs.</p>
              </div>
            ) : (
              <ul className="space-y-0.5 max-h-72 overflow-y-auto -mx-1 px-1">
                {queue.map((item, i) => (
                  <li key={item.videoId}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent/30 transition-colors group">
                    <span className="text-muted/60 text-xs w-4 text-center font-mono tabular-nums shrink-0">{i + 1}</span>
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt="" className="w-10 h-7 rounded-md object-cover shrink-0" />
                      : <div className="w-10 h-7 rounded-md bg-ink/10 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                      <p className="text-xs text-muted truncate">by {item.addedBy}</p>
                    </div>
                    <span className="text-xs font-semibold text-muted shrink-0 tabular-nums">
                      ↑ {Math.round(item.score)}
                    </span>
                    <button
                      onClick={() => handlePlayNow(item)}
                      disabled={!connected || !started}
                      title={started ? 'Play this song now' : 'Start the party first'}
                      className="btn-ghost py-1 px-2 shrink-0 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </main>
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
  const icons = {
    error:   <AlertCircle className="w-4 h-4 shrink-0" />,
    success: <CheckCircle className="w-4 h-4 shrink-0" />,
    info:    null,
  }
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-brutal border-2 text-sm font-medium animate-slide-down max-w-xs ${styles[toast.type] ?? styles.info}`}>
      {icons[toast.type]}
      <span>{toast.msg}</span>
    </div>
  )
}
