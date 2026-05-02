package ct01.n06.backend.repository;

import ct01.n06.backend.entity.UserEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, String> {
  Optional<UserEntity> findByUsername(String username);

  Optional<UserEntity> findByUsernameIgnoreCase(String username);

  Optional<UserEntity> findByEmail(String email);

  Optional<UserEntity> findByEmailIgnoreCase(String email);

  boolean existsByEmail(String email);

  boolean existsByEmailIgnoreCase(String email);

  boolean existsByUsernameIgnoreCase(String username);

  @org.springframework.data.jpa.repository.Query("SELECT LOWER(u.email) FROM UserEntity u WHERE u.email IS NOT NULL")
  java.util.Set<String> findAllEmailsLower();

  @org.springframework.data.jpa.repository.Query("SELECT LOWER(u.username) FROM UserEntity u WHERE u.username IS NOT NULL")
  java.util.Set<String> findAllUsernamesLower();
}
