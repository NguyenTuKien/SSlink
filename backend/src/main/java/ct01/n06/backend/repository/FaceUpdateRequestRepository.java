package ct01.n06.backend.repository;

import ct01.n06.backend.entity.FaceUpdateRequestEntity;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FaceUpdateRequestRepository extends JpaRepository<FaceUpdateRequestEntity, Long> {

  boolean existsByStudent_IdAndStatus(String studentId, FaceUpdateRequestStatus status);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Page<FaceUpdateRequestEntity> findByStudent_Id(String studentId, Pageable pageable);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Page<FaceUpdateRequestEntity> findByStudent_IdAndStatus(String studentId, FaceUpdateRequestStatus status,
      Pageable pageable);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Page<FaceUpdateRequestEntity> findByStudent_ClassEntity_LecturerEntity_Id(String lecturerId, Pageable pageable);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Page<FaceUpdateRequestEntity> findByStudent_ClassEntity_LecturerEntity_IdAndStatus(String lecturerId,
      FaceUpdateRequestStatus status, Pageable pageable);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Page<FaceUpdateRequestEntity> findByStudent_ClassEntity_LecturerEntity_IdAndStudent_ClassEntity_Id(
      String lecturerId, Long classId, Pageable pageable);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Page<FaceUpdateRequestEntity> findByStudent_ClassEntity_LecturerEntity_IdAndStudent_ClassEntity_IdAndStatus(
      String lecturerId, Long classId, FaceUpdateRequestStatus status, Pageable pageable);

  @EntityGraph(attributePaths = {"student", "student.classEntity", "reviewedBy"})
  Optional<FaceUpdateRequestEntity> findByIdAndStudent_ClassEntity_LecturerEntity_Id(Long id, String lecturerId);
}
