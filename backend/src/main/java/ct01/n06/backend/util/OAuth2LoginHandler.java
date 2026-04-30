package ct01.n06.backend.util;

import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.security.JwtService;
import ct01.n06.backend.service.DeviceSecurityService;
import ct01.n06.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.DefaultRedirectStrategy;
import org.springframework.security.web.RedirectStrategy;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class OAuth2LoginHandler implements AuthenticationSuccessHandler, AuthenticationFailureHandler {

    private final JwtService jwtService;
    private final UserService userService;
    private final DeviceSecurityService deviceSecurityService;
    private final StringRedisTemplate redisTemplate;
    private final RedirectStrategy redirectStrategy = new DefaultRedirectStrategy();

    @Value("${spring.app.oauth2.redirect.url:http://localhost:5173/oauth-success}")
    private String frontendRedirectUrl;

    @Value("${jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Value("${device.security.cookie-name:device_token}")
    private String deviceCookieName;

    @Value("${device.security.cookie-secure:true}")
    private boolean deviceCookieSecure;

    @Value("${device.binding.ttl-ms:604800000}")
    private long deviceCookieTtlMs;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {
        Object principal = authentication.getPrincipal();
        String principalIdentifier = extractUsername(principal, authentication);
        UserEntity userEntity = userService.findByUsernameOrEmail(principalIdentifier)
                .orElseThrow(() -> new RuntimeException("User not found: " + principalIdentifier));
        String accessToken = jwtService.generateAccessToken(userEntity);
        String refreshToken = jwtService.generateRefreshToken(userEntity.getUsername());
        String fallbackDeviceId = "oauth:" + userEntity.getId() + ":" + UUID.randomUUID();
        String deviceToken = deviceSecurityService.generateDeviceToken(fallbackDeviceId);

        if (isDeviceLockEnforced(userEntity)) {
            // Chỉ sinh viên bị giới hạn 1 phiên đăng nhập.
            String redisKey = "auth:session:" + userEntity.getUsername();
            Boolean locked = redisTemplate.opsForValue().setIfAbsent(redisKey, accessToken, refreshExpirationMs,
                    TimeUnit.MILLISECONDS);
            if (!Boolean.TRUE.equals(locked)) {
                String encodedMessage = URLEncoder.encode("SessionConflict", StandardCharsets.UTF_8);
                String targetUrl = UriComponentsBuilder.fromUriString(frontendRedirectUrl)
                        .queryParam("error", encodedMessage)
                        .build(true)
                        .toUriString();
                redirectStrategy.sendRedirect(request, response, targetUrl);
                return;
            }
        }

        ResponseCookie deviceCookie = ResponseCookie.from(deviceCookieName, deviceToken)
                .path("/")
                .httpOnly(true)
                .secure(deviceCookieSecure)
                .sameSite("Lax")
                .maxAge(deviceCookieTtlMs / 1000)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, deviceCookie.toString());

        String targetUrl = UriComponentsBuilder.fromUriString(frontendRedirectUrl)
                .queryParam("accessToken", accessToken)
                .queryParam("refreshToken", refreshToken)
                .queryParam("deviceToken", deviceToken)
                .build(true)
                .toUriString();
        redirectStrategy.sendRedirect(request, response, targetUrl);
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception) throws IOException {
        String encodedMessage = URLEncoder.encode(exception.getMessage(), StandardCharsets.UTF_8);
        String targetUrl = UriComponentsBuilder.fromUriString(frontendRedirectUrl)
                .queryParam("error", encodedMessage)
                .build(true)
                .toUriString();
        redirectStrategy.sendRedirect(request, response, targetUrl);
    }

    private String extractUsername(Object principal, Authentication authentication) {
        if (principal instanceof OAuth2User oAuth2User) {
            Object email = oAuth2User.getAttributes().get("email");
            if (email == null) {
                email = oAuth2User.getAttributes().get("preferred_username");
            }
            if (email != null && !email.toString().isBlank()) {
                return email.toString();
            }
            return oAuth2User.getName();
        }
        return authentication.getName();
    }

    private boolean isDeviceLockEnforced(UserEntity userEntity) {
        return userEntity != null
                && (userEntity.getRole() == Role.ROLE_STUDENT || userEntity.getRole() == Role.ROLE_MONITOR);
    }
}