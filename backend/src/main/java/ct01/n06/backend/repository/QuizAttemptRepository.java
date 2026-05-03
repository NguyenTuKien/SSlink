package ct01.n06.backend.repository;

import ct01.n06.backend.entity.QuizAttemptEntity;
import ct01.n06.backend.entity.enums.AttemptStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttemptEntity, Long> {

  Optional<QuizAttemptEntity> findTopByQuiz_IdAndStudent_IdOrderByStartTimeDesc(
      Long quizId, String studentId);

  Optional<QuizAttemptEntity> findFirstByQuiz_IdAndStudent_IdAndStatusOrderByStartTimeDesc(
      Long quizId, String studentId, AttemptStatus status);

  long countByQuiz_IdAndStudent_Id(Long quizId, String studentId);

  List<QuizAttemptEntity> findByQuiz_IdAndStatusOrderByEndTimeDesc(
      Long quizId, AttemptStatus status);

  Optional<QuizAttemptEntity> findFirstByQuiz_IdAndStudent_IdAndStatusOrderByEndTimeDesc(
      Long quizId, String studentId, AttemptStatus status);
}
