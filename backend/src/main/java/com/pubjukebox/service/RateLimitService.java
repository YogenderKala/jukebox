package com.pubjukebox.service;

import com.pubjukebox.exception.RateLimitException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class RateLimitService {

    private static final long COOLDOWN_SECONDS = 300;

    private final RedisTemplate<String, String> redis;

    public RateLimitService(RedisTemplate<String, String> redis) {
        this.redis = redis;
    }

    public void checkAndSetCooldown(String roomId, String guestId) {
        String key = "cooldown:" + roomId + ":user:" + guestId;
        if (Boolean.TRUE.equals(redis.hasKey(key))) {
            throw new RateLimitException("Please wait 5 minutes before adding another song.");
        }
        redis.opsForValue().set(key, "1", COOLDOWN_SECONDS, TimeUnit.SECONDS);
    }

    public long remainingCooldown(String roomId, String guestId) {
        String key = "cooldown:" + roomId + ":user:" + guestId;
        Long ttl = redis.getExpire(key, TimeUnit.SECONDS);
        return ttl != null && ttl > 0 ? ttl : 0;
    }
}
