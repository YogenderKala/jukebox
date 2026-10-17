package com.pubjukebox.controller;

import com.pubjukebox.model.dto.SongResult;
import com.pubjukebox.service.YouTubeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final YouTubeService youTubeService;

    public SearchController(YouTubeService youTubeService) {
        this.youTubeService = youTubeService;
    }

    @GetMapping
    public ResponseEntity<List<SongResult>> search(@RequestParam String q) {
        if (q == null || q.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(youTubeService.search(q));
    }
}
