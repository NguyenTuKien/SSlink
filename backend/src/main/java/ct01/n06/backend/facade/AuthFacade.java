package ct01.n06.backend.facade;

import ct01.n06.backend.dto.auth.LoginRequest;
import ct01.n06.backend.dto.auth.LoginResponse;
import ct01.n06.backend.dto.auth.UserInfoResponse;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.security.JwtService;
import ct01.n06.backend.service.DeviceSecurityService;
import ct01.n06.backend.service.LecturerService;
import ct01.n06.backend.service.StudentService;
import ct01.n06.backend.service.TotpService;
import ct01.n06.backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import ct01.n06.backend.exception.ForbiddenException;
import ct01.n06.backend.exception.NotFoundException;
import ct01.n06.backend.exception.RequestException;
import ct01.n06.backend.exception.ServerException;
import ct01.n06.backend.exception.UnauthorizedException;

import java.util.concurrent.TimeUnit;


@Service
@RequiredArgsConstructor
@Slf4j
public class AuthFacade {

    @Value("${jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Value("${device.security.hmac-secret:ChangeThisDeviceSecretKey}")
    private String deviceHmacSecret;

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;
    private final LecturerService lecturerService;
    private final StudentService studentService;
    private final TotpService totpService;
    private final StringRedisTemplate redisTemplate;
    private final DeviceSecurityService deviceSecurityService;

    public LoginResponse login(LoginRequest request, String deviceId) {
        try {
            warnIfDefaultDeviceSecret();
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
            );
            String subject = authentication.getName();
            UserEntity userEntity = userService.findByUsernameOrEmail(subject)
                    .orElseThrow(() -> new NotFoundException("User not found"));

            if (deviceId == null || deviceId.isBlank()) {
                throw new RequestException("App phiên bản cũ không được hỗ trợ");
            }
            String deviceToken = deviceSecurityService.generateDeviceToken(deviceId.trim());

            String totpSecretToReturn = null;
            if (userEntity.getTotpSecret() == null || userEntity.getTotpSecret().isBlank()) {
                userEntity.setTotpSecret(totpService.generateSecretKey());
                userEntity = userService.save(userEntity);
                totpSecretToReturn = userEntity.getTotpSecret();
            }

            // 1. Tạo Token cho thiết bị mới (Device B)
            String accessToken = jwtService.generateAccessToken(userEntity);
            String refreshToken = jwtService.generateRefreshToken(subject);

            if (isDeviceLockEnforced(userEntity)) {
                String redisKey = "auth:session:" + subject;

                // Chỉ khóa 1 thiết bị tại 1 thời điểm cho sinh viên.
                Boolean locked = redisTemplate.opsForValue().setIfAbsent(
                        redisKey,
                        accessToken,
                        refreshExpirationMs,
                        TimeUnit.MILLISECONDS
                );

                if (!Boolean.TRUE.equals(locked)) {
                    throw new ForbiddenException("Tài khoản đang được đăng nhập trên thiết bị khác");
                }
            }

            return LoginResponse.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .totpSecret(totpSecretToReturn)
                    .deviceToken(deviceToken)
                    .build();
        } catch (org.springframework.security.core.AuthenticationException ex) {
            throw new UnauthorizedException("Sai tên đăng nhập hoặc mật khẩu");
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ServerException("Lỗi hệ thống: " + ex.getMessage());
        }
    }


    public LoginResponse refreshTokens(String refreshToken, String deviceToken) {
        String username;
        try {
            username = jwtService.extractUsername(refreshToken);
        } catch (Exception ex) {
            throw new UnauthorizedException("Invalid refresh token");
        }

        if (!jwtService.isRefreshTokenValid(refreshToken, username)) {
            throw new UnauthorizedException("Refresh token is expired or revoked");
        }

        UserEntity userEntity = userService.findByUsernameOrEmail(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (deviceToken == null || deviceToken.isBlank()) {
            throw new RequestException("Thiếu device token");
        }
        if (!deviceSecurityService.verifyDeviceToken(deviceToken)) {
            throw new UnauthorizedException("Device token không hợp lệ");
        }

        String newAccessToken = jwtService.generateAccessToken(userEntity);
        String newRefreshToken = jwtService.generateRefreshToken(username);

        if (isDeviceLockEnforced(userEntity)) {
            // Chỉ duy trì khóa session trên Redis cho sinh viên.
            String redisKey = "auth:session:" + username;
            redisTemplate.opsForValue().set(
                    redisKey,
                    newAccessToken,
                    refreshExpirationMs,
                    TimeUnit.MILLISECONDS
            );
        }

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .deviceToken(deviceToken)
                .build();
    }

    private void warnIfDefaultDeviceSecret() {
        if (deviceHmacSecret == null) {
            return;
        }
        if ("ChangeThisDeviceSecretKey".equals(deviceHmacSecret.trim())) {
            log.warn("Cảnh báo: Đang dùng HMAC secret mặc định!");
        }
    }

    private boolean isDeviceLockEnforced(UserEntity user) {
        return user != null
                && (user.getRole() == Role.ROLE_STUDENT || user.getRole() == Role.ROLE_MONITOR);
    }

    public UserInfoResponse getCurrentUserInfo(Authentication authentication) {
        String principalIdentifier = resolvePrincipalIdentifier(authentication);

        // 1. Tìm User chính
        UserEntity user = userService.findByUsernameOrEmail(principalIdentifier)
                .orElseThrow(() -> new UnauthorizedException("User not found"));

        // 2. Khởi tạo Builder với các thông tin cơ bản
        UserInfoResponse.UserInfoResponseBuilder builder = UserInfoResponse.builder()
                .role(user.getRole().name());

        if (user.getRole() == Role.ROLE_LECTURER) {
            LecturerEntity lecturer = lecturerService.getLecturerByUser(user);
            builder.userId(user.getId());
            builder.fullName(lecturer.getFullName());
            builder.profileCode(lecturer.getLecturerCode());
        }
        else if (user.getRole() == Role.ROLE_STUDENT || user.getRole() == Role.ROLE_MONITOR) {
            StudentEntity student = studentService.getStudentByUser(user);
            builder.userId(user.getId());
            builder.fullName(student.getFullName());
            builder.profileCode(student.getStudentCode());
        }
        else if (user.getRole() == Role.ROLE_ADMIN) {
            builder.userId(user.getId());
            builder.fullName("Administrator");
            builder.profileCode(user.getUsername());
        }

        return builder.build();
    }

    public void logout(String accessToken, String refreshToken) {
        String usernameToClear = null;

        if (accessToken != null && !accessToken.isBlank()) {
            try {
                usernameToClear = jwtService.extractUsername(accessToken);
            } catch (io.jsonwebtoken.ExpiredJwtException e) {
                if (e.getClaims() != null) {
                    usernameToClear = e.getClaims().getSubject();
                }
            } catch (Exception e) {
                log.warn("Lỗi khi extract accessToken lúc logout: {}", e.getMessage());
            }
            
            try {
                jwtService.blacklist(accessToken);
            } catch (Exception ignore) {}
        }

        if (refreshToken != null && !refreshToken.isBlank()) {
            if (usernameToClear == null) {
                try {
                    usernameToClear = jwtService.extractUsername(refreshToken);
                } catch (io.jsonwebtoken.ExpiredJwtException e) {
                    if (e.getClaims() != null) {
                        usernameToClear = e.getClaims().getSubject();
                    }
                } catch (Exception e) {
                    log.warn("Lỗi khi extract refreshToken lúc logout: {}", e.getMessage());
                }
            }
            
            try {
                jwtService.blacklist(refreshToken);
            } catch (Exception ignore) {}
        }

        if (usernameToClear != null) {
            String redisKey = "auth:session:" + usernameToClear;
            Boolean deleted = redisTemplate.delete(redisKey);
            log.info("LOGOUT: Deleted Redis key '{}' -> result={}", redisKey, deleted);
        } else {
            log.warn("LOGOUT: Could not extract username from tokens - Redis lock NOT cleared!");
        }
        SecurityContextHolder.clearContext();
    }

    private String resolvePrincipalIdentifier(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof OAuth2User oAuth2User) {
            Object email = oAuth2User.getAttributes().get("email");
            if (email == null) {
                email = oAuth2User.getAttributes().get("preferred_username");
            }
            if (email != null && !email.toString().isBlank()) {
                return email.toString();
            }
        }
        return authentication.getName();
    }
}
