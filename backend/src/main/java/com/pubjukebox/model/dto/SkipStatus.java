package com.pubjukebox.model.dto;

public record SkipStatus(String videoId, long votes, long required) {}
