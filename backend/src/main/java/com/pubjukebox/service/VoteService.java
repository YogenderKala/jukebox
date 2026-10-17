package com.pubjukebox.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class VoteService {

    private final RedisTemplate<String, String> redis;

    public VoteService(RedisTemplate<String, String> redis) {
        this.redis = redis;
    }

    /**
     * Returns true if the vote was accepted, false if already voted.
     * direction: +1 upvote, -1 downvote.
     */
    public boolean vote(String roomId, String videoId, String guestId, int direction) {
        String voteKey = "votes:" + roomId + ":video:" + videoId;
        String memberKey = guestId + ":" + (direction > 0 ? "up" : "down");

        Long added = redis.opsForSet().add(voteKey, memberKey);
        if (added == null || added == 0) {
            return false; // already voted this direction
        }

        double delta = direction > 0 ? 1.0 : -1.0;
        redis.opsForZSet().incrementScore("queue:" + roomId, videoId, delta);
        return true;
    }

    /** Records a skip-vote on the currently playing song. Returns false if this guest already voted. */
    public boolean downvoteCurrent(String roomId, String videoId, String guestId) {
        Long added = redis.opsForSet().add(skipKey(roomId, videoId), guestId);
        return added != null && added > 0;
    }

    public long skipVotes(String roomId, String videoId) {
        if (videoId == null || videoId.isBlank()) return 0;
        Long n = redis.opsForSet().size(skipKey(roomId, videoId));
        return n != null ? n : 0;
    }

    public void clearSkipVotes(String roomId, String videoId) {
        redis.delete(skipKey(roomId, videoId));
    }

    private String skipKey(String roomId, String videoId) {
        return "skipvotes:" + roomId + ":" + videoId;
    }
}
