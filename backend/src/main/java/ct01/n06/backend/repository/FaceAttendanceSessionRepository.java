package ct01.n06.backend.repository;

import ct01.n06.backend.entity.FaceAttendanceSessionEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FaceAttendanceSessionRepository extends JpaRepository<FaceAttendanceSessionEntity, Long> {

  @EntityGraph(attributePaths = {"lecturer", "classEntity", "event", "semester"})
  Optional<FaceAttendanceSessionEntity> findByIdAndLecturer_Id(Long id, String lecturerId);
}
