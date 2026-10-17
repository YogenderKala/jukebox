package com.pubjukebox.controller;

import com.pubjukebox.model.dto.*;
import com.pubjukebox.service.*;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.data.redis.core.RedisTemplate;

import java.util.List;
import java.util.Optional;

@Controller
public class RoomSocketController {

    private final SimpMessagingTemplate messaging;
    private final QueueService queueService;
    private final VoteService voteService;
    private final RateLimitService rateLimitService;
    private final GuestService guestService;
    private final RedisTemplate<String, String> redis;
    private final RoomService roomService;

    public RoomSocketController(SimpMessagingTemplate messaging,
                                QueueService queueService,
                                VoteService voteService,
                                RateLimitService rateLimitService,
                                GuestService guestService,
                                RedisTemplate<String, String> redis,
                                RoomService roomService) {
        this.messaging = messaging;
        this.queueService = queueService;
        this.voteService = voteService;
        this.rateLimitService = rateLimitService;
        this.guestService = guestService;
        this.redis = redis;
        this.roomService = roomService;
    }

    /** Guest connects and requests current state — broadcasts to whole room. */
    @MessageMapping("/room/{roomId}/subscribe")
    public void subscribe(@DestinationVariable String roomId) {
        // Room already closed (ended or expired): tell the late joiner instead of recreating state
        if (!roomService.exists(roomId)) {
            messaging.convertAndSend("/topic/room/" + roomId + "/ended", new RoomEnded("ENDED"));
            return;
        }
        roomService.touch(roomId);

        broadcastQueue(roomId);

        String currentlyPlaying = (String) redis.opsForHash()
                .get("room:" + roomId, "currentlyPlaying");

        if (currentlyPlaying != null && !currentlyPlaying.isBlank()) {
            var meta = redis.opsForHash().entries("song:" + roomId + ":" + currentlyPlaying);
            NowPlaying np = new NowPlaying(
                    currentlyPlaying,
                    (String) meta.getOrDefault("title", ""),
                    (String) meta.getOrDefault("thumbnail", ""),
                    false
            );
            messaging.convertAndSend("/topic/room/" + roomId + "/playing", np);
        }

        broadcastSkipStatus(roomId, currentlyPlaying);
    }

    /** Guest adds a song — applies cooldown, writes metadata, increments score, broadcasts queue. */
    @MessageMapping("/room/{roomId}/addSong")
    public void addSong(@DestinationVariable String roomId,
                        @Payload AddSongMessage msg,
                        @Header("guest-id") String guestId) {
        if (!activeRoom(roomId)) return;

        boolean isHost = guestId != null && guestId.startsWith("host-");
        if (!isHost) {
            try {
                rateLimitService.checkAndSetCooldown(roomId, guestId);
            } catch (com.pubjukebox.exception.RateLimitException ex) {
                messaging.convertAndSend("/topic/room/" + roomId + "/error",
                        new ErrorMessage(guestId, "RATE_LIMIT", ex.getMessage()));
                return;
            }
        }

        String displayName = guestService.getDisplayName(roomId, guestId);
        queueService.addSong(roomId, msg.videoId(), msg.title(), msg.thumbnail(),
                msg.channelTitle(), displayName);

        broadcastQueue(roomId);
    }

    /** Guest votes on a song — debounces per guest per video, broadcasts updated queue. */
    @MessageMapping("/room/{roomId}/vote")
    public void vote(@DestinationVariable String roomId,
                     @Payload VoteMessage msg,
                     @Header("guest-id") String guestId) {
        if (!activeRoom(roomId)) return;

        int direction = msg.direction() >= 0 ? 1 : -1;
        boolean accepted = voteService.vote(roomId, msg.videoId(), guestId, direction);

        if (!accepted) {
            messaging.convertAndSend("/topic/room/" + roomId + "/error",
                    new ErrorMessage(guestId, "ALREADY_VOTED", "You have already voted on this song."));
            return;
        }

        broadcastQueue(roomId);
    }

    /** Host signals a track ended — pops next highest-scored song and broadcasts it. */
    @MessageMapping("/room/{roomId}/next")
    public void next(@DestinationVariable String roomId) {
        if (!activeRoom(roomId)) return;

        playSong(roomId, queueService.popNext(roomId));
    }

    /** Guest downvotes the currently playing song — a majority of guests skips to the next song. */
    @MessageMapping("/room/{roomId}/downvoteCurrent")
    public void downvoteCurrent(@DestinationVariable String roomId,
                                @Payload SkipVoteMessage msg,
                                @Header("guest-id") String guestId) {
        if (!activeRoom(roomId)) return;

        if (guestId == null || guestId.startsWith("host-") || !guestService.isGuest(roomId, guestId)) {
            return;
        }

        // Ignore votes for a song that is no longer playing (client state can be stale)
        String current = currentlyPlaying(roomId);
        if (current.isBlank() || !current.equals(msg.videoId())) {
            return;
        }

        if (!voteService.downvoteCurrent(roomId, current, guestId)) {
            messaging.convertAndSend("/topic/room/" + roomId + "/error",
                    new ErrorMessage(guestId, "ALREADY_VOTED", "You have already downvoted this song."));
            return;
        }

        if (voteService.skipVotes(roomId, current) >= requiredSkipVotes(roomId)) {
            playSong(roomId, queueService.popNext(roomId));
        } else {
            broadcastSkipStatus(roomId, current);
        }
    }

    /** Host plays a specific queued song immediately. */
    @MessageMapping("/room/{roomId}/playNow")
    public void playNow(@DestinationVariable String roomId,
                        @Payload PlayNowMessage msg,
                        @Header("guest-id") String guestId) {
        if (!activeRoom(roomId)) return;

        if (!isHost(roomId, guestId)) {
            messaging.convertAndSend("/topic/room/" + roomId + "/error",
                    new ErrorMessage(guestId, "NOT_HOST", "Only the host can pick a song."));
            return;
        }

        Optional<NowPlaying> song = queueService.popSpecific(roomId, msg.videoId());
        if (song.isEmpty()) {
            messaging.convertAndSend("/topic/room/" + roomId + "/error",
                    new ErrorMessage(guestId, "NOT_IN_QUEUE", "That song is no longer in the queue."));
            broadcastQueue(roomId);
            return;
        }

        playSong(roomId, song);
    }

    /** Switches playback to the given song (or idles if empty), resets skip votes and broadcasts state. */
    private void playSong(String roomId, Optional<NowPlaying> song) {
        String previous = currentlyPlaying(roomId);
        if (!previous.isBlank()) {
            voteService.clearSkipVotes(roomId, previous);
        }

        if (song.isEmpty()) {
            redis.opsForHash().put("room:" + roomId, "status", "IDLE");
            redis.opsForHash().put("room:" + roomId, "currentlyPlaying", "");
            messaging.convertAndSend("/topic/room/" + roomId + "/playing", NowPlaying.none());
            broadcastSkipStatus(roomId, "");
        } else {
            NowPlaying np = song.get();
            redis.opsForHash().put("room:" + roomId, "currentlyPlaying", np.videoId());
            redis.opsForHash().put("room:" + roomId, "status", "ACTIVE");
            messaging.convertAndSend("/topic/room/" + roomId + "/playing", np);
            broadcastSkipStatus(roomId, np.videoId());
        }

        broadcastQueue(roomId);
    }

    /** False if the room has been closed; otherwise records activity so it isn't swept as idle. */
    private boolean activeRoom(String roomId) {
        if (!roomService.exists(roomId)) return false;
        roomService.touch(roomId);
        return true;
    }

    private String currentlyPlaying(String roomId) {
        Object current = redis.opsForHash().get("room:" + roomId, "currentlyPlaying");
        return current != null ? current.toString() : "";
    }

    private boolean isHost(String roomId, String guestId) {
        Object hostId = redis.opsForHash().get("room:" + roomId, "hostId");
        return hostId != null && guestId != null && guestId.equals("host-" + hostId);
    }

    /** Strict majority of guests in the room. */
    private long requiredSkipVotes(String roomId) {
        return guestService.getGuestCount(roomId) / 2 + 1;
    }

    private void broadcastSkipStatus(String roomId, String videoId) {
        boolean playing = videoId != null && !videoId.isBlank();
        SkipStatus status = new SkipStatus(
                playing ? videoId : "",
                playing ? voteService.skipVotes(roomId, videoId) : 0,
                playing ? requiredSkipVotes(roomId) : 0
        );
        messaging.convertAndSend("/topic/room/" + roomId + "/skip", status);
    }

    private void broadcastQueue(String roomId) {
        List<QueueItem> queue = queueService.getQueue(roomId);
        messaging.convertAndSend("/topic/room/" + roomId + "/queue", queue);
    }
}
