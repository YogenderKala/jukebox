package com.pubjukebox.service;

import com.pubjukebox.model.dto.NowPlaying;
import com.pubjukebox.model.dto.QueueItem;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class QueueService {

    private final RedisTemplate<String, String> redis;

    public QueueService(RedisTemplate<String, String> redis) {
        this.redis = redis;
    }

    public void addSong(String roomId, String videoId, String title, String thumbnail,
                        String channelTitle, String addedBy) {
        String metaKey = "song:" + roomId + ":" + videoId;

        // Only write metadata if song is new to the queue
        Double existing = redis.opsForZSet().score("queue:" + roomId, videoId);
        if (existing == null) {
            Map<String, String> meta = new HashMap<>();
            meta.put("title", title);
            meta.put("thumbnail", thumbnail);
            meta.put("channelTitle", channelTitle);
            meta.put("addedBy", addedBy);
            redis.opsForHash().putAll(metaKey, meta);
        }

        // ZINCRBY — works as initial add (score 0→1) and as duplicate-add increment
        redis.opsForZSet().incrementScore("queue:" + roomId, videoId, 1.0);
    }

    public List<QueueItem> getQueue(String roomId) {
        // Highest score first
        Set<ZSetOperations.TypedTuple<String>> entries =
                redis.opsForZSet().reverseRangeWithScores("queue:" + roomId, 0, -1);

        if (entries == null || entries.isEmpty()) return Collections.emptyList();

        List<QueueItem> items = new ArrayList<>();
        for (ZSetOperations.TypedTuple<String> entry : entries) {
            String videoId = entry.getValue();
            double score = entry.getScore() != null ? entry.getScore() : 0;
            Map<Object, Object> meta = redis.opsForHash().entries("song:" + roomId + ":" + videoId);

            items.add(new QueueItem(
                    videoId,
                    (String) meta.getOrDefault("title", "Unknown"),
                    (String) meta.getOrDefault("thumbnail", ""),
                    (String) meta.getOrDefault("channelTitle", ""),
                    (String) meta.getOrDefault("addedBy", ""),
                    score
            ));
        }
        return items;
    }

    public Optional<NowPlaying> popNext(String roomId) {
        // ZPOPMAX requires Redis 5.0+; use ZREVRANGE + ZREM for compatibility
        Set<String> top = redis.opsForZSet().reverseRange("queue:" + roomId, 0, 0);

        if (top == null || top.isEmpty()) return Optional.empty();

        return Optional.of(removeFromQueue(roomId, top.iterator().next()));
    }

    /** Removes a specific song from the queue so it can be played immediately; empty if it isn't queued. */
    public Optional<NowPlaying> popSpecific(String roomId, String videoId) {
        if (videoId == null || redis.opsForZSet().score("queue:" + roomId, videoId) == null) {
            return Optional.empty();
        }
        return Optional.of(removeFromQueue(roomId, videoId));
    }

    private NowPlaying removeFromQueue(String roomId, String videoId) {
        redis.opsForZSet().remove("queue:" + roomId, videoId);
        Map<Object, Object> meta = redis.opsForHash().entries("song:" + roomId + ":" + videoId);

        // Clean up vote debounce set
        redis.delete("votes:" + roomId + ":video:" + videoId);

        return new NowPlaying(
                videoId,
                (String) meta.getOrDefault("title", "Unknown"),
                (String) meta.getOrDefault("thumbnail", ""),
                false
        );
    }

    public void removeVideo(String roomId, String videoId) {
        redis.opsForZSet().remove("queue:" + roomId, videoId);
        redis.delete("song:" + roomId + ":" + videoId);
        redis.delete("votes:" + roomId + ":video:" + videoId);
    }
}
