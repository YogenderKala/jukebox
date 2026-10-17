package com.pubjukebox;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PubJukeboxApplication {
    public static void main(String[] args) {
        SpringApplication.run(PubJukeboxApplication.class, args);
    }
}
