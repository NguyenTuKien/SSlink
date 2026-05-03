package ct01.n06.backend.entity;

import ct01.n06.backend.constant.QuizConstant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = QuizConstant.TABLE_ANSWER_KEYS,
    uniqueConstraints = @UniqueConstraint(columnNames = {
        QuizConstant.COL_AK_QUIZ_ID,
        QuizConstant.COL_AK_QUESTION_NUMBER
    })
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder
public class QuizAnswerKeyEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = QuizConstant.COL_AK_ID)
  @EqualsAndHashCode.Include
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = QuizConstant.COL_AK_QUIZ_ID, nullable = false)
  private QuizEntity quiz;

  @Column(name = QuizConstant.COL_AK_QUESTION_NUMBER, nullable = false)
  private Integer questionNumber;

  @Column(name = QuizConstant.COL_AK_CORRECT_OPTION, nullable = false, length = 1)
  private String correctOption;
}
