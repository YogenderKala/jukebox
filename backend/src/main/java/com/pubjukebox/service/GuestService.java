package com.pubjukebox.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
public class GuestService {

    private final RedisTemplate<String, String> redis;

    public GuestService(RedisTemplate<String, String> redis) {
        this.redis = redis;
    }

    public Map<String, String> addGuest(String roomId, String displayName) {
        String guestId = UUID.randomUUID().toString();
        String key = "guest:" + roomId + ":" + guestId;

        Map<String, String> fields = Map.of("displayName", displayName.trim());
        redis.opsForHash().putAll(key, fields);
        redis.expire(key, Duration.ofHours(6));

        redis.opsForSet().add("guests:" + roomId, guestId);

        return Map.of("guestId", guestId, "displayName", displayName.trim());
    }

    public String getDisplayName(String roomId, String guestId) {
        Object name = redis.opsForHash().get("guest:" + roomId + ":" + guestId, "displayName");
        return name != null ? name.toString() : "Guest";
    }

    public long getGuestCount(String roomId) {
        Long count = redis.opsForSet().size("guests:" + roomId);
        return count != null ? count : 0;
    }

    public boolean isGuest(String roomId, String guestId) {
        return Boolean.TRUE.equals(redis.opsForSet().isMember("guests:" + roomId, guestId));
    }

    public boolean guestExists(String roomId, String guestId) {
        return Boolean.TRUE.equals(redis.hasKey("guest:" + roomId + ":" + guestId));
    }
}
