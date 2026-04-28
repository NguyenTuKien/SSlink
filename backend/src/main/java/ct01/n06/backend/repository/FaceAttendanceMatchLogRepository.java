package ct01.n06.backend.repository;

import ct01.n06.backend.entity.FaceAttendanceMatchLogEntity;
import ct01.n06.backend.entity.enums.FaceAttendanceMatchResult;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FaceAttendanceMatchLogRepository extends JpaRepository<FaceAttendanceMatchLogEntity, Long> {

  boolean existsBySession_IdAndStudent_IdAndResult(Long sessionId, String studentId,
      FaceAttendanceMatchResult result);

  List<FaceAttendanceMatchLogEntity> findBySession_IdAndStudent_IdInAndResult(Long sessionId,
      Collection<String> studentIds, FaceAttendanceMatchResult result);

  List<FaceAttendanceMatchLogEntity> findBySession_IdAndStudent_IdInAndResultIn(
      Long sessionId,
      Collection<String> studentIds,
      Collection<FaceAttendanceMatchResult> results);

  List<FaceAttendanceMatchLogEntity> findBySession_IdAndResultIn(
      Long sessionId,
      Collection<FaceAttendanceMatchResult> results);
}
