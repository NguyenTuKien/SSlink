package ct01.n06.backend.service;

import ct01.n06.backend.dto.quiz.AttemptResultResponse;
import ct01.n06.backend.dto.quiz.CreateQuizRequest;
import ct01.n06.backend.dto.quiz.ExamResultRowResponse;
import ct01.n06.backend.dto.quiz.QuizAttemptResponse;
import ct01.n06.backend.dto.quiz.QuizDetailResponse;
import ct01.n06.backend.dto.quiz.QuizSummaryResponse;
import ct01.n06.backend.dto.quiz.SaveAnswerRequest;
import ct01.n06.backend.dto.quiz.StudentQuizListResponse;
import ct01.n06.backend.dto.quiz.UpdateQuizRequest;
import java.util.List;

public interface QuizService {

  QuizSummaryResponse createQuiz(String lecturerId, CreateQuizRequest request);

  List<QuizSummaryResponse> getLecturerQuizzes(String lecturerId);

  QuizSummaryResponse updateQuiz(String lecturerId, Long quizId, UpdateQuizRequest request);

  void deleteQuiz(String lecturerId, Long quizId);

  QuizSummaryResponse publishQuiz(String lecturerId, Long quizId);

  QuizSummaryResponse closeQuiz(String lecturerId, Long quizId);

  List<ExamResultRowResponse> getExamResults(String lecturerId, Long quizId);

  StudentQuizListResponse getStudentQuizzes(String studentId);

  QuizDetailResponse getQuizDetail(String studentId, Long quizId);

  QuizAttemptResponse startOrResumeAttempt(String studentId, Long quizId);

  QuizAttemptResponse saveAnswer(String studentId, Long quizId, Long attemptId,
      SaveAnswerRequest request);

  AttemptResultResponse submitAttempt(String studentId, Long quizId, Long attemptId);

  AttemptResultResponse getAttemptResult(String studentId, Long quizId);
}
