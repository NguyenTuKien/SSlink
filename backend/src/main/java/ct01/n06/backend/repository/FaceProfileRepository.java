package ct01.n06.backend.repository;

import ct01.n06.backend.entity.FaceProfileEntity;
import ct01.n06.backend.entity.enums.FaceProfileStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FaceProfileRepository extends JpaRepository<FaceProfileEntity, Long> {

  @EntityGraph(attributePaths = {"student", "student.classEntity"})
  Optional<FaceProfileEntity> findByStudent_Id(String studentId);

  boolean existsByStudent_Id(String studentId);

  @EntityGraph(attributePaths = {"student", "student.classEntity"})
  List<FaceProfileEntity> findByStudent_ClassEntity_IdAndStatus(Long classId, FaceProfileStatus status);
}
