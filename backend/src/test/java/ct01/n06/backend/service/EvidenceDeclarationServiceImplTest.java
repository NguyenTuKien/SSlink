package ct01.n06.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.evidence.CreateEvidenceDeclarationRequest;
import ct01.n06.backend.dto.evidence.EvidenceDeclarationDetailResponse;
import ct01.n06.backend.dto.evidence.EvidenceDeclarationListResponse;
import ct01.n06.backend.dto.evidence.ReviewEvidenceDeclarationRequest;
import ct01.n06.backend.dto.evidence.UpdateEvidenceDeclarationRequest;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.CriteriaEntity;
import ct01.n06.backend.entity.NotificationEntity;
import ct01.n06.backend.entity.RecordEntity;
import ct01.n06.backend.entity.SemesterEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.RecordStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.CriteriaRepository;
import ct01.n06.backend.repository.NotificationRecipientRepository;
import ct01.n06.backend.repository.NotificationRepository;
import ct01.n06.backend.repository.RecordRepository;
import ct01.n06.backend.repository.SemesterRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.service.impl.EvidenceDeclarationServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("EvidenceDeclarationServiceImpl Unit Tests")
class EvidenceDeclarationServiceImplTest {

    @Mock private RecordRepository recordRepository;
    @Mock private StudentRepository studentRepository;
    @Mock private ClassRepository classRepository;
    @Mock private SemesterRepository semesterRepository;
    @Mock private CriteriaRepository criteriaRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationRecipientRepository notificationRecipientRepository;

    @InjectMocks
    private EvidenceDeclarationServiceImpl evidenceDeclarationService;

    private UserEntity testUser;
    private UserEntity monitorUser;
    private StudentEntity testStudent;
    private StudentEntity testMonitor;
    private ClassEntity testClass;
    private SemesterEntity testSemester;
    private RecordEntity testRecord;
    private CriteriaEntity testCriteria;

    @BeforeEach
    void setUp() {
        testUser = UserEntity.builder().id("u1").username("sv1").build();
        monitorUser = UserEntity.builder().id("u2").username("monitor").build();

        testClass = ClassEntity.builder().id(1L).classCode("C1").build();

        testStudent = StudentEntity.builder()
                .id("s1")
                .fullName("Sinh Vien")
                .userEntity(testUser)
                .classEntity(testClass)
                .build();

        testMonitor = StudentEntity.builder()
                .id("s2")
                .fullName("Lop Truong")
                .userEntity(monitorUser)
                .classEntity(testClass)
                .build();
        testClass.setMonitor(testMonitor);

        testSemester = SemesterEntity.builder().id(1L).name("HK1").build();
        testCriteria = CriteriaEntity.builder().id(1L).code("TC1").name("Tiêu chí 1").build();

        testRecord = RecordEntity.builder()
                .id(1L)
                .student(testStudent)
                .semester(testSemester)
                .customName("Chứng chỉ tiếng Anh")
                .evidenceUrl("https://example.com/chungchi.pdf")
                .activityTime(LocalDate.now().atStartOfDay())
                .status(RecordStatus.PENDING)
                .build();
        testRecord.setCreatedAt(LocalDateTime.now());
    }

    @Test
    @DisplayName("createStudentDeclaration - success")
    void createStudentDeclaration_success() {
        CreateEvidenceDeclarationRequest request = new CreateEvidenceDeclarationRequest(
                1L, "Chứng chỉ", "https://url.com", LocalDate.now()
        );

        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));
        when(recordRepository.save(any(RecordEntity.class))).thenReturn(testRecord);

        EvidenceDeclarationDetailResponse response = evidenceDeclarationService.createStudentDeclaration("u1", request);

        assertThat(response.customName()).isEqualTo("Chứng chỉ tiếng Anh");
        assertThat(response.status()).isEqualTo(RecordStatus.PENDING.name());
        verify(recordRepository).save(any(RecordEntity.class));
    }

    @Test
    @DisplayName("createStudentDeclaration - invalid url throws Exception")
    void createStudentDeclaration_invalidUrl() {
        CreateEvidenceDeclarationRequest request = new CreateEvidenceDeclarationRequest(
                1L, "Chứng chỉ", "invalid_url", LocalDate.now()
        );

        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));

        assertThatThrownBy(() -> evidenceDeclarationService.createStudentDeclaration("u1", request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Đường dẫn minh chứng phải bắt đầu bằng");
    }

    @Test
    @DisplayName("getStudentDeclarations - returns paginated list")
    void getStudentDeclarations_success() {
        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        Page<RecordEntity> page = new PageImpl<>(List.of(testRecord));
        when(recordRepository.findEvidenceDeclarationsForStudent(any(), any(), any(), any(PageRequest.class)))
                .thenReturn(page);

        EvidenceDeclarationListResponse response = evidenceDeclarationService.getStudentDeclarations(
                "u1", null, null, 0, 10
        );

        assertThat(response.totalItems()).isEqualTo(1);
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).customName()).isEqualTo("Chứng chỉ tiếng Anh");
    }

    @Test
    @DisplayName("getStudentDeclarationDetail - success")
    void getStudentDeclarationDetail_success() {
        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        when(recordRepository.findByIdAndStudent_IdAndEventIsNull(1L, "s1")).thenReturn(Optional.of(testRecord));

        EvidenceDeclarationDetailResponse response = evidenceDeclarationService.getStudentDeclarationDetail("u1", 1L);

        assertThat(response.id()).isEqualTo(1L);
    }

    @Test
    @DisplayName("updateStudentDeclaration - success")
    void updateStudentDeclaration_success() {
        UpdateEvidenceDeclarationRequest request = new UpdateEvidenceDeclarationRequest(
                "Tên mới", "https://new.com", LocalDate.now()
        );

        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        when(recordRepository.findByIdAndStudent_IdAndEventIsNull(1L, "s1")).thenReturn(Optional.of(testRecord));
        when(recordRepository.save(any(RecordEntity.class))).thenReturn(testRecord);

        EvidenceDeclarationDetailResponse response = evidenceDeclarationService.updateStudentDeclaration("u1", 1L, request);

        assertThat(response).isNotNull();
        verify(recordRepository).save(any(RecordEntity.class));
    }

    @Test
    @DisplayName("updateStudentDeclaration - not pending throws Exception")
    void updateStudentDeclaration_notPending() {
        UpdateEvidenceDeclarationRequest request = new UpdateEvidenceDeclarationRequest(
                "Tên mới", "https://new.com", LocalDate.now()
        );
        testRecord.setStatus(RecordStatus.APPROVED);

        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        when(recordRepository.findByIdAndStudent_IdAndEventIsNull(1L, "s1")).thenReturn(Optional.of(testRecord));

        assertThatThrownBy(() -> evidenceDeclarationService.updateStudentDeclaration("u1", 1L, request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Minh chứng đã được xử lý");
    }

    @Test
    @DisplayName("deleteStudentDeclaration - success")
    void deleteStudentDeclaration_success() {
        when(studentRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testStudent));
        when(recordRepository.findByIdAndStudent_IdAndEventIsNull(1L, "s1")).thenReturn(Optional.of(testRecord));

        SimpleMessageResponse response = evidenceDeclarationService.deleteStudentDeclaration("u1", 1L);

        assertThat(response.message()).contains("Đã xóa");
        verify(recordRepository).delete(testRecord);
    }

    @Test
    @DisplayName("getMonitorDeclarations - success")
    void getMonitorDeclarations_success() {
        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testMonitor));
        when(classRepository.findByMonitor_Id("s2")).thenReturn(Optional.of(testClass));
        
        Page<RecordEntity> page = new PageImpl<>(List.of(testRecord));
        when(recordRepository.findEvidenceDeclarationsForClass(any(), any(), any(), any(PageRequest.class)))
                .thenReturn(page);

        EvidenceDeclarationListResponse response = evidenceDeclarationService.getMonitorDeclarations("u2", null, null, 0, 10);

        assertThat(response.totalItems()).isEqualTo(1);
    }

    @Test
    @DisplayName("approveMonitorDeclaration - success")
    void approveMonitorDeclaration_success() {
        ReviewEvidenceDeclarationRequest request = new ReviewEvidenceDeclarationRequest(1L, "Duyệt nhé");

        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testMonitor));
        when(classRepository.findByMonitor_Id("s2")).thenReturn(Optional.of(testClass));
        when(recordRepository.findByIdAndEventIsNull(1L)).thenReturn(Optional.of(testRecord));
        when(criteriaRepository.findById(1L)).thenReturn(Optional.of(testCriteria));
        when(recordRepository.save(any(RecordEntity.class))).thenReturn(testRecord);
        when(notificationRepository.save(any())).thenReturn(NotificationEntity.builder().classEntity(testClass).build());

        EvidenceDeclarationDetailResponse response = evidenceDeclarationService.approveMonitorDeclaration("u2", 1L, request);

        assertThat(testRecord.getStatus()).isEqualTo(RecordStatus.APPROVED);
        assertThat(testRecord.getReviewNote()).isEqualTo("Duyệt nhé");
        assertThat(testRecord.getCriteria()).isEqualTo(testCriteria);
        assertThat(testRecord.getApprover()).isEqualTo(monitorUser);
        
        verify(recordRepository).save(testRecord);
        verify(notificationRepository).save(any());
        verify(notificationRecipientRepository).save(any());
    }

    @Test
    @DisplayName("rejectMonitorDeclaration - success")
    void rejectMonitorDeclaration_success() {
        ReviewEvidenceDeclarationRequest request = new ReviewEvidenceDeclarationRequest(null, "Không hợp lệ");

        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testMonitor));
        when(classRepository.findByMonitor_Id("s2")).thenReturn(Optional.of(testClass));
        when(recordRepository.findByIdAndEventIsNull(1L)).thenReturn(Optional.of(testRecord));
        when(recordRepository.save(any(RecordEntity.class))).thenReturn(testRecord);
        when(notificationRepository.save(any())).thenReturn(NotificationEntity.builder().classEntity(testClass).build());

        EvidenceDeclarationDetailResponse response = evidenceDeclarationService.rejectMonitorDeclaration("u2", 1L, request);

        assertThat(testRecord.getStatus()).isEqualTo(RecordStatus.REJECTED);
        assertThat(testRecord.getReviewNote()).isEqualTo("Không hợp lệ");
        
        verify(recordRepository).save(testRecord);
        verify(notificationRepository).save(any());
    }
}
