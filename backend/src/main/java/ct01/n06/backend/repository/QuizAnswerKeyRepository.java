package ct01.n06.backend.repository;

import ct01.n06.backend.entity.QuizAnswerKeyEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizAnswerKeyRepository extends JpaRepository<QuizAnswerKeyEntity, Long> {

  List<QuizAnswerKeyEntity> findByQuiz_IdOrderByQuestionNumberAsc(Long quizId);

  void deleteByQuiz_Id(Long quizId);
}
