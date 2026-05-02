package ct01.n06.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import ct01.n06.backend.dto.admin.JobStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisImportTrackerService {
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private static final String KEY_PREFIX = "import_job:";

    public void initJob(JobStatus jobStatus) {
        saveJob(jobStatus);
    }

    public void updateJob(JobStatus jobStatus) {
        saveJob(jobStatus);
    }

    public JobStatus getJob(String batchId) {
        String json = redisTemplate.opsForValue().get(KEY_PREFIX + batchId);
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, JobStatus.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse JobStatus from Redis for batchId: {}", batchId, e);
            return null;
        }
    }

    private void saveJob(JobStatus jobStatus) {
        try {
            String json = objectMapper.writeValueAsString(jobStatus);
            redisTemplate.opsForValue().set(KEY_PREFIX + jobStatus.getBatchId(), json, 24, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize JobStatus to Redis for batchId: {}", jobStatus.getBatchId(), e);
        }
    }
}
