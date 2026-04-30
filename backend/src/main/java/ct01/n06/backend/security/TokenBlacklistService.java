package ct01.n06.backend.security;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Date;

/**
 * Token blacklist backed by Redis.
 * Key = token string, Value = "1", TTL = remaining token lifetime.
 */
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private static final String BLACKLIST_PREFIX = "auth:blacklist:";

    private final StringRedisTemplate redisTemplate;

    public void blacklist(String token, Date expiresAt) {
        if (token == null || expiresAt == null) {
            return;
        }
        long ttlMs = expiresAt.getTime() - System.currentTimeMillis();
        if (ttlMs <= 0) {
            return; // token đã hết hạn, không cần blacklist
        }
        redisTemplate.opsForValue()
                .set(BLACKLIST_PREFIX + token, "1", Duration.ofMillis(ttlMs));
    }

    public boolean isBlacklisted(String token) {
        if (token == null) {
            return false;
        }
        return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + token));
    }
}
