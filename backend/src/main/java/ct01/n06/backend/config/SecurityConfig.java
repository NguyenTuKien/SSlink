package ct01.n06.backend.config;

import ct01.n06.backend.filter.ApiResponseCacheFilter;
import ct01.n06.backend.filter.JwtAuthenticationFilter;
import ct01.n06.backend.security.CustomOidcUserService;
import ct01.n06.backend.util.HttpCookieOAuth2AuthorizationRequestRepository;
import ct01.n06.backend.util.OAuth2LoginHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final ApiResponseCacheFilter apiResponseCacheFilter;
        private final HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository;
        private final UserDetailsService userDetailsService;
        private final PasswordEncoder passwordEncoder;

        @Value("${cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173}")
        private String allowedOrigins;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http,
                        CustomOidcUserService customOidcUserService,
                        OAuth2LoginHandler oAuth2LoginHandler) throws Exception {
                http
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .csrf(csrf -> csrf.disable())
                                // 1. ĐỔI THÀNH STATELESS: Chuẩn kiến trúc JWT
                                .sessionManagement(sess -> sess.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                                .exceptionHandling(ex -> ex
                                                .authenticationEntryPoint(
                                                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                                .authorizeHttpRequests(auth -> auth
                                                // Mở khóa các endpoint cần thiết
                                                .requestMatchers("/v1/auth/login", "/v1/auth/refresh", "/v1/auth/logout", "/oauth2/**",
                                                                "/login/**", "/error", "/actuator/**")
                                                .permitAll()
                                                .requestMatchers("/v1/admin/**").hasAuthority("ROLE_ADMIN")
                                                .requestMatchers("/v1/lecturer/**").hasAuthority("ROLE_LECTURER")
                                                .requestMatchers("/v1/monitor/**").hasAuthority("ROLE_MONITOR")
                                                .anyRequest().authenticated())
                                .oauth2Login(oauth -> oauth
                                                // 2. QUAN TRỌNG: Lưu event vào Cookie để tránh lỗi
                                                // [authorization_request_not_found]
                                                .authorizationEndpoint(auth -> auth
                                                                .authorizationRequestRepository(
                                                                                cookieAuthorizationRequestRepository))
                                                .userInfoEndpoint(userInfo -> userInfo
                                                                .oidcUserService(customOidcUserService))
                                                .successHandler(oAuth2LoginHandler)
                                                .failureHandler(oAuth2LoginHandler))
                                // 3. Đặt filter JWT lên trước
                                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterAfter(apiResponseCacheFilter, JwtAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();
                // Rút gọn logic CORS
                config.setAllowedOriginPatterns(List.of(allowedOrigins.split(",")));
                config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
                config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept"));
                config.setExposedHeaders(List.of("Authorization"));
                config.setAllowCredentials(true);
                config.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", config);
                return source;
        }

        @Bean
        public AuthenticationProvider authenticationProvider() {
                DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService);
                authProvider.setPasswordEncoder(passwordEncoder);
                return authProvider;
        }

        @Bean
        public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
                return config.getAuthenticationManager();
        }
}
