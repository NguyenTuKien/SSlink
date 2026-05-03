package ct01.n06.backend.repository;

import ct01.n06.backend.entity.QuizEntity;
import ct01.n06.backend.entity.enums.QuizStatus;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizRepository extends JpaRepository<QuizEntity, Long> {

  @EntityGraph(attributePaths = {"createdBy", "assignments", "assignments.classEntity"})
  List<QuizEntity> findByCreatedBy_IdOrderByCreatedAtDesc(String userId);

  @Query("""
      SELECT DISTINCT q FROM QuizEntity q
      JOIN q.assignments a
      WHERE a.classEntity.id = :classId
        AND q.status = :status
      ORDER BY q.startTime DESC
      """)
  List<QuizEntity> findPublishedQuizzesByClassId(
      @Param("classId") Long classId,
      @Param("status") QuizStatus status
  );

  boolean existsByIdAndCreatedBy_Id(Long quizId, String userId);
}
