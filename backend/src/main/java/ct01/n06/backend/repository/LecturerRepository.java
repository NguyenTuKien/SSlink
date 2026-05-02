package ct01.n06.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;

@Repository
public interface LecturerRepository extends JpaRepository<LecturerEntity, String> {

  int countByUserEntity_Role(Role role);

  Optional<LecturerEntity> findByUserEntity_EmailIgnoreCase(String email);

  Optional<LecturerEntity> findByUserEntity(UserEntity userEntity);

  @EntityGraph(attributePaths = {"facultyEntity"})
  Optional<LecturerEntity> findByUserEntityId(String userId);
  Optional<LecturerEntity> findByUserEntity_Username(String username);

  @EntityGraph(attributePaths = {"userEntity", "facultyEntity"})
  List<LecturerEntity> findAllByUserEntity_Role(Role role);

  int countByUserEntity_Status(UserStatus status);

  boolean existsByLecturerCodeIgnoreCase(String lecturerCode);

  @org.springframework.data.jpa.repository.Query("SELECT LOWER(l.lecturerCode) FROM LecturerEntity l WHERE l.lecturerCode IS NOT NULL")
  java.util.Set<String> findAllLecturerCodesLower();
}
