package ct01.n06.backend.entity;

import ct01.n06.backend.constant.QuizConstant;
import ct01.n06.backend.entity.enums.AttemptStatus;
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
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = QuizConstant.TABLE_ATTEMPTS)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder
public class QuizAttemptEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = QuizConstant.COL_ATT_ID)
  @EqualsAndHashCode.Include
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = QuizConstant.COL_ATT_QUIZ_ID, nullable = false)
  private QuizEntity quiz;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = QuizConstant.COL_ATT_STUDENT_ID, referencedColumnName = "id", nullable = false)
  private StudentEntity student;

  @Column(name = QuizConstant.COL_ATT_START_TIME, nullable = false)
  private LocalDateTime startTime;

  @Column(name = QuizConstant.COL_ATT_END_TIME)
  private LocalDateTime endTime;

  @Column(name = QuizConstant.COL_ATT_SCORE, precision = 5, scale = 2)
  private BigDecimal score;

  /**
   * JSON lưu phiếu tô màu của sinh viên.
   * Dùng @JdbcTypeCode để map Map<String, String> thành jsonb trong PostgreSQL.
   */
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = QuizConstant.COL_ATT_STUDENT_ANSWERS_JSON, columnDefinition = "jsonb")
  @Builder.Default
  private Map<String, String> studentAnswers = new HashMap<>();

  @Enumerated(EnumType.STRING)
  @Column(name = QuizConstant.COL_ATT_STATUS, length = 20)
  private AttemptStatus status;
}
