package com.pubjukebox.controller;

import com.pubjukebox.model.dto.GuestJoinRequest;
import com.pubjukebox.model.dto.GuestJoinResponse;
import com.pubjukebox.service.GuestService;
import com.pubjukebox.service.RoomService;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms/{roomId}/join")
public class GuestController {

    private final GuestService guestService;
    private final RedisTemplate<String, String> redis;
    private final RoomService roomService;

    public GuestController(GuestService guestService, RedisTemplate<String, String> redis, RoomService roomService) {
        this.guestService = guestService;
        this.redis = redis;
        this.roomService = roomService;
    }

    @PostMapping
    public ResponseEntity<GuestJoinResponse> join(
            @PathVariable String roomId,
            @RequestBody GuestJoinRequest request) {

        if (!Boolean.TRUE.equals(redis.hasKey("room:" + roomId))) {
            return ResponseEntity.notFound().build();
        }

        String name = request.displayName();
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        roomService.touch(roomId);
        Map<String, String> guest = guestService.addGuest(roomId, name);
        return ResponseEntity.ok(new GuestJoinResponse(
                guest.get("guestId"),
                guest.get("displayName"),
                roomId
        ));
    }
}
