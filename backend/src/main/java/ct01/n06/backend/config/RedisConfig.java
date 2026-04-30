package ct01.n06.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;
import org.springframework.data.redis.core.RedisKeyValueAdapter;

import org.springframework.context.annotation.Profile;

@Configuration
public class RedisConfig {

    @Configuration
    @Profile("!test")
    @EnableRedisRepositories(enableKeyspaceEvents = RedisKeyValueAdapter.EnableKeyspaceEvents.ON_STARTUP)
    public static class RedisRepositoryConfig {
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    @Bean
    public DefaultRedisScript<Long> rateLimitScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setResultType(Long.class);
        script.setScriptText(
                "local key = KEYS[1]\n" +
                        "local limit = tonumber(ARGV[1])\n" +
                        "local expire_time = tonumber(ARGV[2])\n" +
                        "local current = tonumber(redis.call('get', key) or '0')\n" +
                        "if current >= limit then\n" +
                        "   return 0\n" +
                        "else\n" +
                        "   redis.call('incr', key)\n" +
                        "   if current == 0 then\n" +
                        "       redis.call('expire', key, expire_time)\n" +
                        "   end\n" +
                        "   return 1\n" +
                        "end"
        );
        return script;
    }
}

