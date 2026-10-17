package com.pubjukebox.model.dto;

public record QueueItem(
        String videoId,
        String title,
        String thumbnail,
        String channelTitle,
        String addedBy,
        double score
) {}
