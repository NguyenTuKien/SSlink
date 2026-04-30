package ct01.n06.backend.filter;

import ct01.n06.backend.security.CustomUserDetailsService;
import ct01.n06.backend.security.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final StringRedisTemplate redisTemplate;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/oauth2/")
                || path.startsWith("/login/oauth2/")
                || path.startsWith("/v1/auth/login")
                || path.startsWith("/v1/auth/refresh")
                || path.startsWith("/v1/auth/logout");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        final String username;

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        jwt = authHeader.substring(7);
        try {
            username = jwtService.extractUsername(jwt);
        } catch (Exception ex) {
            filterChain.doFilter(request, response);
            return;
        }

        // THÊM ĐIỀU KIỆN KIỂM TRA SecurityContextHolder ĐỂ TỐI ƯU
        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    if (isDeviceLockEnforced(userDetails)) {
                        String redisKey = "auth:session:" + username;
                        String tokenInRedis = (String) redisTemplate.opsForValue().get(redisKey);

                        // Sinh viên: Redis không có token hoặc lệch token => bị từ chối.
                        if (tokenInRedis == null || !tokenInRedis.equals(jwt)) {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.setCharacterEncoding("UTF-8");
                            String errorJson = "{"
                                    + "\"success\": false, "
                                    + "\"message\": \"Tài khoản đã bị ngắt kết nối hoặc đăng nhập ở thiết bị khác.\", "
                                    + "\"type\": \"about:blank\", "
                                    + "\"title\": \"Unauthorized\", "
                                    + "\"detail\": \"Tài khoản đã bị ngắt kết nối hoặc đăng nhập ở thiết bị khác.\""
                                    + "}";
                            response.getWriter().write(errorJson);
                            return;
                        }
                    }

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (UsernameNotFoundException ex) {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isDeviceLockEnforced(UserDetails userDetails) {
        return userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role -> "ROLE_STUDENT".equals(role) || "ROLE_MONITOR".equals(role));
    }
}
