package com.pubjukebox.service;

import com.pubjukebox.model.dto.RoomEnded;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class RoomService {

    private static final Logger log = LoggerFactory.getLogger(RoomService.class);
    private static final String ACTIVITY_KEY = "rooms:activity";

    private final RedisTemplate<String, String> redis;
    private final SimpMessagingTemplate messaging;
    private final long idleMillis;

    public RoomService(RedisTemplate<String, String> redis,
                       SimpMessagingTemplate messaging,
                       @Value("${app.room-idle-hours:12}") long idleHours) {
        this.redis = redis;
        this.messaging = messaging;
        this.idleMillis = idleHours * 3_600_000L;
    }

    public boolean exists(String roomId) {
        return Boolean.TRUE.equals(redis.hasKey("room:" + roomId));
    }

    public boolean isHost(String roomId, String hostId) {
        Object stored = redis.opsForHash().get("room:" + roomId, "hostId");
        return stored != null && hostId != null && stored.toString().equals(hostId);
    }

    /** Records activity so an in-use room isn't swept as idle. */
    public void touch(String roomId) {
        redis.opsForZSet().add(ACTIVITY_KEY, roomId, System.currentTimeMillis());
    }

    /** Notifies everyone in the room, then deletes every key belonging to it. */
    public void endRoom(String roomId, String reason) {
        if (roomId == null || !roomId.matches("[A-Za-z0-9]{3,10}")) {
            return;
        }

        messaging.convertAndSend("/topic/room/" + roomId + "/ended", new RoomEnded(reason));

        redis.delete(List.of("room:" + roomId, "queue:" + roomId, "guests:" + roomId));
        for (String pattern : List.of(
                "song:" + roomId + ":*",
                "votes:" + roomId + ":video:*",
                "skipvotes:" + roomId + ":*",
                "guest:" + roomId + ":*",
                "cooldown:" + roomId + ":user:*")) {
            deleteByPattern(pattern);
        }
        redis.opsForZSet().remove(ACTIVITY_KEY, roomId);
        log.info("Room {} closed ({})", roomId, reason);
    }

    @Scheduled(fixedDelayString = "${app.room-cleanup-interval-ms:600000}")
    public void expireIdleRooms() {
        long cutoff = System.currentTimeMillis() - idleMillis;
        Set<String> stale = redis.opsForZSet().rangeByScore(ACTIVITY_KEY, 0, cutoff);
        if (stale == null) return;
        for (String roomId : stale) {
            endRoom(roomId, "EXPIRED");
        }
    }

    /** Rooms created before activity tracking existed get a starting timestamp so they can expire too. */
    @EventListener(ApplicationReadyEvent.class)
    public void trackExistingRooms() {
        long now = System.currentTimeMillis();
        List<String> roomKeys = new ArrayList<>();
        try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match("room:*").count(200).build())) {
            cursor.forEachRemaining(roomKeys::add);
        }
        for (String key : roomKeys) {
            String roomId = key.substring("room:".length());
            if (redis.opsForZSet().score(ACTIVITY_KEY, roomId) == null) {
                redis.opsForZSet().add(ACTIVITY_KEY, roomId, now);
            }
        }
    }

    private void deleteByPattern(String pattern) {
        List<String> keys = new ArrayList<>();
        try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match(pattern).count(200).build())) {
            cursor.forEachRemaining(keys::add);
        }
        if (!keys.isEmpty()) {
            redis.delete(keys);
        }
    }
}
