package com.pubjukebox.model.dto;

import java.util.List;

public record RoomStateResponse(
        String roomId,
        String status,
        NowPlaying nowPlaying,
        List<QueueItem> queue,
        long guestCount
) {}
