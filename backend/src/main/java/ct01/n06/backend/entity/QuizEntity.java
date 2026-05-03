package ct01.n06.backend.entity;

import ct01.n06.backend.constant.QuizConstant;
import ct01.n06.backend.entity.enums.QuizStatus;
import ct01.n06.backend.entity.enums.QuizType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = QuizConstant.TABLE_QUIZZES)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder
public class QuizEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = QuizConstant.COL_QUIZ_ID)
  @EqualsAndHashCode.Include
  private Long id;

  @Column(name = QuizConstant.COL_QUIZ_TITLE, nullable = false, length = 255)
  private String title;

  @Column(name = QuizConstant.COL_QUIZ_SUBJECT, length = 100)
  private String subject;

  @Enumerated(EnumType.STRING)
  @Column(name = QuizConstant.COL_QUIZ_TYPE, nullable = false, length = 20)
  private QuizType type;

  @Column(name = QuizConstant.COL_EXAM_IMAGE_URL, nullable = false, length = 500)
  private String examImageUrl;

  @Column(name = QuizConstant.COL_TOTAL_QUESTIONS, nullable = false)
  private Integer totalQuestions;

  @Column(name = QuizConstant.COL_TIME_LIMIT_MINUTES)
  private Integer timeLimitMinutes;

  @Column(name = QuizConstant.COL_MAX_ATTEMPTS)
  private Integer maxAttempts;

  @Column(name = QuizConstant.COL_START_TIME)
  private LocalDateTime startTime;

  @Column(name = QuizConstant.COL_END_TIME)
  private LocalDateTime endTime;

  @Enumerated(EnumType.STRING)
  @Column(name = QuizConstant.COL_QUIZ_STATUS, length = 20)
  private QuizStatus status;

  @CreationTimestamp
  @Column(name = QuizConstant.COL_QUIZ_CREATED_AT, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = QuizConstant.COL_QUIZ_UPDATED_AT)
  private LocalDateTime updatedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = QuizConstant.COL_QUIZ_CREATED_BY, referencedColumnName = "id")
  private UserEntity createdBy;

  @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
  @Builder.Default
  private List<QuizAnswerKeyEntity> answerKeys = new ArrayList<>();

  @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
  @Builder.Default
  private List<QuizAssignmentEntity> assignments = new ArrayList<>();

  @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
  @Builder.Default
  private List<QuizAttemptEntity> attempts = new ArrayList<>();

  @PreUpdate
  private void onUpdate() {
    this.updatedAt = LocalDateTime.now();
  }
}
