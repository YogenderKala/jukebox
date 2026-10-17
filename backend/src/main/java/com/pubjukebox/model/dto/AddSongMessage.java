package com.pubjukebox.model.dto;

public record AddSongMessage(String videoId, String title, String thumbnail, String channelTitle) {}
