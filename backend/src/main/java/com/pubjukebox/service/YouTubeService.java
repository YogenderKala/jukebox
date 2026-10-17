package com.pubjukebox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pubjukebox.model.dto.SongResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class YouTubeService {

    @Value("${youtube.api.key}")
    private String apiKey;

    @Value("${youtube.api.base-url}")
    private String baseUrl;

    @Value("${youtube.api.max-results:10}")
    private int maxResults;

    private final RedisTemplate<String, String> redis;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public YouTubeService(RedisTemplate<String, String> redis) {
        this.redis = redis;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public List<SongResult> search(String query) {
        String normalizedQuery = query.trim().toLowerCase();
        String cacheKey = "search:" + normalizedQuery;

        // Check cache
        String cached = redis.opsForValue().get(cacheKey);
        if (cached != null) {
            return deserializeResults(cached);
        }

        String url = UriComponentsBuilder.fromHttpUrl(baseUrl + "/search")
                .queryParam("part", "snippet")
                .queryParam("q", query)
                .queryParam("type", "video")
                .queryParam("videoCategoryId", "10")
                .queryParam("maxResults", maxResults)
                .queryParam("key", apiKey)
                .toUriString();

        try {
            String response = restTemplate.getForObject(url, String.class);
            List<SongResult> results = parseResults(response);
            redis.opsForValue().set(cacheKey, serializeResults(results), 180, TimeUnit.SECONDS);
            return results;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<SongResult> parseResults(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode items = root.path("items");
            List<SongResult> results = new ArrayList<>();

            for (JsonNode item : items) {
                String videoId = item.path("id").path("videoId").asText();
                JsonNode snippet = item.path("snippet");
                String title = snippet.path("title").asText();
                String channelTitle = snippet.path("channelTitle").asText();
                String thumbnail = snippet.path("thumbnails").path("medium").path("url").asText();

                if (!videoId.isBlank()) {
                    results.add(new SongResult(videoId, title, thumbnail, channelTitle));
                }
            }
            return results;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String serializeResults(List<SongResult> results) {
        try {
            return objectMapper.writeValueAsString(results);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<SongResult> deserializeResults(String json) {
        try {
            return objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, SongResult.class));
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
