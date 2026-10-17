import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'

export default function useRoomSocket(roomId, guestId, { onError } = {}) {
  const [queue, setQueue] = useState([])
  const [nowPlaying, setNowPlaying] = useState(null)
  const [skipStatus, setSkipStatus] = useState(null)
  const [ended, setEnded] = useState(null)
  const [connected, setConnected] = useState(false)
  const clientRef = useRef(null)

  useEffect(() => {
    setQueue([])
    setNowPlaying(null)
    setSkipStatus(null)
    setEnded(null)

    console.log('[useRoomSocket] effect — roomId:', roomId, '| guestId:', guestId)
    if (!roomId || !guestId) {
      console.log('[useRoomSocket] skipping — missing roomId or guestId')
      return
    }

    // Native WebSocket direct to backend — bypasses Vite proxy entirely.
    // Using window.location.hostname ensures LAN phones (192.168.x.x) also connect correctly.
    const wsUrl = `ws://${window.location.hostname}:8080/stomp`
    console.log('[useRoomSocket] connecting to', wsUrl)

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { 'guest-id': guestId },
      reconnectDelay: 3000,
      debug: (msg) => console.log('[STOMP]', msg),
      onConnect: () => {
        console.log('[useRoomSocket] CONNECTED ✓')
        setConnected(true)

        client.subscribe(`/topic/room/${roomId}/queue`, (msg) => {
          setQueue(JSON.parse(msg.body))
        })

        client.subscribe(`/topic/room/${roomId}/playing`, (msg) => {
          setNowPlaying(JSON.parse(msg.body))
        })

        client.subscribe(`/topic/room/${roomId}/skip`, (msg) => {
          setSkipStatus(JSON.parse(msg.body))
        })

        client.subscribe(`/topic/room/${roomId}/ended`, (msg) => {
          setEnded(JSON.parse(msg.body))
          client.deactivate()
        })

        client.subscribe(`/topic/room/${roomId}/error`, (msg) => {
          const err = JSON.parse(msg.body)
          if (err.guestId === guestId && onError) {
            onError(err)
          }
        })

        client.publish({
          destination: `/app/room/${roomId}/subscribe`,
          headers: { 'guest-id': guestId },
          body: JSON.stringify({}),
        })
      },
      onDisconnect: () => {
        console.log('[useRoomSocket] DISCONNECTED')
        setConnected(false)
      },
      onStompError: (frame) => {
        console.error('[useRoomSocket] STOMP error', frame)
        if (onError) onError({ message: 'WebSocket error — check backend connection.' })
      },
      onWebSocketError: (evt) => {
        console.error('[useRoomSocket] WebSocket error', evt)
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      console.log('[useRoomSocket] cleanup — deactivating')
      client.deactivate()
    }
  }, [roomId, guestId]) // eslint-disable-line react-hooks/exhaustive-deps

  const publish = useCallback((destination, body) => {
    if (!clientRef.current?.connected) {
      console.warn('[useRoomSocket] publish skipped — not connected')
      return
    }
    clientRef.current.publish({
      destination,
      headers: { 'guest-id': guestId },
      body: JSON.stringify(body),
    })
  }, [guestId])

  const addSong = useCallback((song) => {
    publish(`/app/room/${roomId}/addSong`, song)
  }, [publish, roomId])

  const vote = useCallback((videoId, direction) => {
    publish(`/app/room/${roomId}/vote`, { videoId, direction })
  }, [publish, roomId])

  const next = useCallback(() => {
    publish(`/app/room/${roomId}/next`, {})
  }, [publish, roomId])

  const downvoteCurrent = useCallback((videoId) => {
    publish(`/app/room/${roomId}/downvoteCurrent`, { videoId })
  }, [publish, roomId])

  const playNow = useCallback((videoId) => {
    publish(`/app/room/${roomId}/playNow`, { videoId })
  }, [publish, roomId])

  return { queue, nowPlaying, skipStatus, ended, connected, addSong, vote, next, downvoteCurrent, playNow }
}
