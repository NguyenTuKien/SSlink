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
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(
    name = QuizConstant.TABLE_ASSIGNMENTS,
    uniqueConstraints = @UniqueConstraint(columnNames = {
        QuizConstant.COL_ASSIGN_QUIZ_ID,
        QuizConstant.COL_ASSIGN_CLASS_ID
    })
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder
public class QuizAssignmentEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = QuizConstant.COL_ASSIGN_ID)
  @EqualsAndHashCode.Include
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = QuizConstant.COL_ASSIGN_QUIZ_ID, nullable = false)
  private QuizEntity quiz;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = QuizConstant.COL_ASSIGN_CLASS_ID, nullable = false)
  private ClassEntity classEntity;

  @CreationTimestamp
  @Column(name = QuizConstant.COL_ASSIGN_ASSIGNED_AT, updatable = false)
  private LocalDateTime assignedAt;
}
