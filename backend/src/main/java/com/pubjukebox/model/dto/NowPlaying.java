package com.pubjukebox.model.dto;

public record NowPlaying(String videoId, String title, String thumbnail, boolean empty) {
    public static NowPlaying none() {
        return new NowPlaying(null, null, null, true);
    }
}
