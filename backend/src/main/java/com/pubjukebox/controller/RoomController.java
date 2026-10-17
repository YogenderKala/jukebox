package com.pubjukebox.controller;

import com.pubjukebox.model.dto.CreateRoomResponse;
import com.pubjukebox.model.dto.NowPlaying;
import com.pubjukebox.model.dto.RoomStateResponse;
import com.pubjukebox.service.GuestService;
import com.pubjukebox.service.QueueService;
import com.pubjukebox.service.RoomService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

import java.security.SecureRandom;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    private final RedisTemplate<String, String> redis;
    private final QueueService queueService;
    private final GuestService guestService;
    private final SimpMessagingTemplate messaging;
    private final RoomService roomService;

    public RoomController(RedisTemplate<String, String> redis,
                          QueueService queueService,
                          GuestService guestService,
                          SimpMessagingTemplate messaging,
                          RoomService roomService) {
        this.redis = redis;
        this.queueService = queueService;
        this.guestService = guestService;
        this.messaging = messaging;
        this.roomService = roomService;
    }

    @PostMapping
    public ResponseEntity<CreateRoomResponse> createRoom() {
        String roomId = generateRoomCode();
        String hostId = UUID.randomUUID().toString();

        redis.opsForHash().put("room:" + roomId, "hostId", hostId);
        redis.opsForHash().put("room:" + roomId, "status", "WAITING");
        redis.opsForHash().put("room:" + roomId, "currentlyPlaying", "");
        roomService.touch(roomId);

        String joinUrl = baseUrl + "/join/" + roomId;
        return ResponseEntity.ok(new CreateRoomResponse(roomId, hostId, joinUrl));
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<RoomStateResponse> getRoomState(@PathVariable String roomId) {
        Map<Object, Object> roomData = redis.opsForHash().entries("room:" + roomId);
        if (roomData.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        String status = (String) roomData.getOrDefault("status", "WAITING");
        String currentlyPlayingId = (String) roomData.getOrDefault("currentlyPlaying", "");

        NowPlaying nowPlaying = NowPlaying.none();
        if (currentlyPlayingId != null && !currentlyPlayingId.isBlank()) {
            Map<Object, Object> meta = redis.opsForHash()
                    .entries("song:" + roomId + ":" + currentlyPlayingId);
            nowPlaying = new NowPlaying(
                    currentlyPlayingId,
                    (String) meta.getOrDefault("title", ""),
                    (String) meta.getOrDefault("thumbnail", ""),
                    false
            );
        }

        return ResponseEntity.ok(new RoomStateResponse(
                roomId,
                status,
                nowPlaying,
                queueService.getQueue(roomId),
                guestService.getGuestCount(roomId)
        ));
    }

    @PostMapping("/{roomId}/start")
    public ResponseEntity<Void> startRoom(@PathVariable String roomId) {
        if (!roomService.exists(roomId)) {
            return ResponseEntity.notFound().build();
        }
        roomService.touch(roomId);
        redis.opsForHash().put("room:" + roomId, "status", "ACTIVE");

        // Pop the first song from the queue and broadcast it so playback begins immediately
        Optional<NowPlaying> first = queueService.popNext(roomId);
        if (first.isPresent()) {
            NowPlaying np = first.get();
            redis.opsForHash().put("room:" + roomId, "currentlyPlaying", np.videoId());
            messaging.convertAndSend("/topic/room/" + roomId + "/playing", np);
            messaging.convertAndSend("/topic/room/" + roomId + "/queue", queueService.getQueue(roomId));
        }

        return ResponseEntity.ok().build();
    }

    /** Host closes the room: guests are notified, then all room data is deleted. */
    @PostMapping("/{roomId}/end")
    public ResponseEntity<Void> endRoom(@PathVariable String roomId,
                                        @RequestHeader(value = "X-Host-Id", required = false) String hostId) {
        if (!roomService.exists(roomId)) {
            return ResponseEntity.notFound().build();
        }
        if (!roomService.isHost(roomId, hostId)) {
            return ResponseEntity.status(403).build();
        }
        roomService.endRoom(roomId, "ENDED_BY_HOST");
        return ResponseEntity.noContent().build();
    }

    private String generateRoomCode() {
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
