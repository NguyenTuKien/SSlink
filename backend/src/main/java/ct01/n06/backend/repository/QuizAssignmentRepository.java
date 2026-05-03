package ct01.n06.backend.repository;

import ct01.n06.backend.entity.QuizAssignmentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizAssignmentRepository extends JpaRepository<QuizAssignmentEntity, Long> {

  List<QuizAssignmentEntity> findByQuiz_Id(Long quizId);

  void deleteByQuiz_Id(Long quizId);

  boolean existsByQuiz_IdAndClassEntity_Id(Long quizId, Long classId);
}
