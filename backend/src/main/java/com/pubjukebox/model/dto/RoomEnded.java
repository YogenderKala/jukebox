package com.pubjukebox.model.dto;

/** Broadcast on /topic/room/{id}/ended. reason: ENDED_BY_HOST, EXPIRED or ENDED (room already gone). */
public record RoomEnded(String reason) {}
