package ct01.n06.backend.entity;

import ct01.n06.backend.entity.base.BaseJpaAuditingEntity;
import ct01.n06.backend.entity.enums.FaceUpdateRequestStatus;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "face_update_request")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Builder
public class FaceUpdateRequestEntity extends BaseJpaAuditingEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "student_id", nullable = false)
  private StudentEntity student;

  @Column(name = "old_avatar_url", columnDefinition = "TEXT")
  private String oldAvatarUrl;

  @Column(name = "new_avatar_url", columnDefinition = "TEXT", nullable = false)
  private String newAvatarUrl;

  @Column(name = "new_azure_face_id")
  private String newFaceReferenceId;

  @Column(name = "reason", columnDefinition = "TEXT")
  private String reason;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 50)
  private FaceUpdateRequestStatus status;

  @Column(name = "review_note", columnDefinition = "TEXT")
  private String reviewNote;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "reviewed_by")
  private UserEntity reviewedBy;

  @Column(name = "reviewed_at")
  private LocalDateTime reviewedAt;

  @Column(name = "updated_at")
  private LocalDateTime updatedAt;

  @PrePersist
  void prePersist() {
    if (status == null) {
      status = FaceUpdateRequestStatus.PENDING;
    }
    updatedAt = LocalDateTime.now();
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = LocalDateTime.now();
  }
}
