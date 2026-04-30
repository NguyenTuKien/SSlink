package ct01.n06.backend.filter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Comparator;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.DigestUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Slf4j
@Component
@RequiredArgsConstructor
public class ApiResponseCacheFilter extends OncePerRequestFilter {

  private static final String CACHE_KEY_PREFIX = "api:cache:";
  private static final Pattern EVENT_ATTENDEES_PATH_PATTERN = Pattern.compile("^/v1/events/\\d+/attendees$");
  private static final Pattern QR_GENERATE_PATH_PATTERN = Pattern.compile("^/v1/qrcode/generate$");

  private final StringRedisTemplate stringRedisTemplate;
  private final ObjectMapper objectMapper;

  @Value("${app.response-cache.enabled:true}")
  private boolean cacheEnabled;

  @Value("${app.response-cache.ttl-seconds:45}")
  private long ttlSeconds;

  @Value("${app.response-cache.qrcode-ttl-seconds:5}")
  private long qrcodeTtlSeconds;

  @Value("${app.response-cache.max-body-bytes:524288}")
  private int maxBodyBytes;

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    if (!cacheEnabled) {
      return true;
    }

    if (!"GET".equalsIgnoreCase(request.getMethod())) {
      return true;
    }

    String path = request.getServletPath();
    if (path == null || !path.startsWith("/v1/")) {
      return true;
    }

    // Skip actuator and auth endpoints.
    if (path.startsWith("/v1/auth/") || path.startsWith("/actuator/")) {
      return true;
    }

    // Do not cache volatile check-in attendee list.
    if (EVENT_ATTENDEES_PATH_PATTERN.matcher(path).matches()) {
      return true;
    }

    // Skip specifically for any qrcode related GET EXCEPT generation if any
    if (path.contains("/qrcode/") && !QR_GENERATE_PATH_PATTERN.matcher(path).matches()) {
      return true;
    }

    // Allow caller to bypass cache manually.
    if ("true".equalsIgnoreCase(request.getHeader("X-Bypass-Cache"))
        || "true".equalsIgnoreCase(request.getParameter("noCache"))) {
      return true;
    }

    return false;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      filterChain.doFilter(request, response);
      return;
    }

    String cacheKey = buildCacheKey(request, authentication);
    CachedHttpResponse cachedResponse = readFromCache(cacheKey);
    if (cachedResponse != null) {
      response.setStatus(cachedResponse.status());
      if (cachedResponse.contentType() != null) {
        response.setContentType(cachedResponse.contentType());
      }
      response.setCharacterEncoding(StandardCharsets.UTF_8.name());
      response.setHeader("X-Redis-Cache", "HIT");
      response.getWriter().write(cachedResponse.body());
      return;
    }

    ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
    try {
      filterChain.doFilter(request, wrappedResponse);
      writeToCacheIfEligible(request, cacheKey, wrappedResponse);
      wrappedResponse.setHeader("X-Redis-Cache", "MISS");
    } finally {
      wrappedResponse.copyBodyToResponse();
    }
  }

  private String buildCacheKey(HttpServletRequest request, Authentication authentication) {
    String principal = authentication.getName();
    String roles = authentication.getAuthorities().stream()
        .map(GrantedAuthority::getAuthority)
        .sorted(Comparator.naturalOrder())
        .collect(Collectors.joining(","));
    String path = request.getServletPath();
    String query = request.getQueryString() == null ? "" : request.getQueryString();

    String raw = principal + "|" + roles + "|" + path + "|" + query;
    String hash = DigestUtils.md5DigestAsHex(raw.getBytes(StandardCharsets.UTF_8));
    return CACHE_KEY_PREFIX + hash;
  }

  private CachedHttpResponse readFromCache(String cacheKey) {
    try {
      String cachedJson = stringRedisTemplate.opsForValue().get(cacheKey);
      if (cachedJson == null || cachedJson.isBlank()) {
        return null;
      }
      return objectMapper.readValue(cachedJson, CachedHttpResponse.class);
    } catch (Exception ex) {
      log.warn("Cannot read API response cache key={}, fallback to origin", cacheKey, ex);
      return null;
    }
  }

  private void writeToCacheIfEligible(HttpServletRequest request, String cacheKey, ContentCachingResponseWrapper response) {
    if (ttlSeconds <= 0) {
      return;
    }

    int status = response.getStatus();
    if (status != HttpServletResponse.SC_OK) {
      return;
    }

    byte[] bodyBytes = response.getContentAsByteArray();
    if (bodyBytes == null || bodyBytes.length == 0 || bodyBytes.length > maxBodyBytes) {
      return;
    }

    String contentType = response.getContentType();
    if (contentType == null || !contentType.toLowerCase().contains("application/json")) {
      return;
    }

    String body = new String(bodyBytes, StandardCharsets.UTF_8);
    CachedHttpResponse payload = new CachedHttpResponse(status, contentType, body);

    long finalTtl = ttlSeconds;
    String path = request.getServletPath();
    if (path != null && QR_GENERATE_PATH_PATTERN.matcher(path).matches()) {
      finalTtl = qrcodeTtlSeconds;
    }

    if (finalTtl <= 0) {
      return;
    }

    try {
      String value = objectMapper.writeValueAsString(payload);
      stringRedisTemplate.opsForValue().set(cacheKey, value, Duration.ofSeconds(finalTtl));
    } catch (JsonProcessingException ex) {
      log.warn("Cannot serialize API response cache payload for key={}", cacheKey, ex);
    } catch (RuntimeException ex) {
      log.warn("Cannot write API response cache key={}", cacheKey, ex);
    }
  }

  private record CachedHttpResponse(int status, String contentType, String body) {
  }
}
