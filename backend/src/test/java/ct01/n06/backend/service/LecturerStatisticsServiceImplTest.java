package ct01.n06.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import ct01.n06.backend.dto.lecturer.LecturerClassStatisticsResponse;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.SemesterEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.StudentSemesterEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.RecordStatus;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.RecordRepository;
import ct01.n06.backend.repository.RecordRepository.StudentJoinedCountProjection;
import ct01.n06.backend.repository.SemesterRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.repository.StudentSemesterRepository;
import ct01.n06.backend.service.impl.LecturerStatisticsServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("LecturerStatisticsServiceImpl Unit Tests")
class LecturerStatisticsServiceImplTest {

    @Mock private UserService userService;
    @Mock private ClassRepository classRepository;
    @Mock private StudentRepository studentRepository;
    @Mock private SemesterRepository semesterRepository;
    @Mock private StudentSemesterRepository studentSemesterRepository;
    @Mock private RecordRepository recordRepository;

    @InjectMocks
    private LecturerStatisticsServiceImpl lecturerStatisticsService;

    private ClassEntity testClass;
    private SemesterEntity testSemester;
    private StudentEntity testStudent1;
    private StudentEntity testStudent2;

    @BeforeEach
    void setUp() {
        testClass = ClassEntity.builder().id(1L).classCode("C1").build();
        testSemester = SemesterEntity.builder().id(1L).name("HK1").build();

        UserEntity user1 = UserEntity.builder().id("u1").email("sv1@test.com").status(UserStatus.ACTIVE).build();
        UserEntity user2 = UserEntity.builder().id("u2").email("sv2@test.com").status(UserStatus.ACTIVE).build();

        testStudent1 = StudentEntity.builder().id("s1").studentCode("SV01").fullName("A Nguyen").userEntity(user1).build();
        testStudent2 = StudentEntity.builder().id("s2").studentCode("SV02").fullName("B Tran").userEntity(user2).build();
    }

    @Test
    @DisplayName("getClassStatistics - success with students")
    void getClassStatistics_success() {
        when(userService.requireCurrentUserId()).thenReturn("l1");
        when(classRepository.findByIdAndLecturerEntityId(1L, "l1")).thenReturn(Optional.of(testClass));
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));
        when(studentRepository.findAllByClassEntityId(1L)).thenReturn(List.of(testStudent1, testStudent2));

        StudentSemesterEntity eval1 = StudentSemesterEntity.builder().student(testStudent1).finalScore(95).build();
        StudentSemesterEntity eval2 = StudentSemesterEntity.builder().student(testStudent2).finalScore(70).build();
        when(studentSemesterRepository.findBySemester_IdAndStudent_IdIn(eq(1L), any()))
                .thenReturn(List.of(eval1, eval2));

        StudentJoinedCountProjection proj1 = new StudentJoinedCountProjection() {
            @Override public String getStudentId() { return "s1"; }
            @Override public long getJoinedCount() { return 5; }
        };
        StudentJoinedCountProjection proj2 = new StudentJoinedCountProjection() {
            @Override public String getStudentId() { return "s2"; }
            @Override public long getJoinedCount() { return 0; }
        };
        when(recordRepository.countEventJoinsBySemesterAndStudentIdsAndStatus(eq(1L), any(), eq(RecordStatus.APPROVED)))
                .thenReturn(List.of(proj1, proj2));

        LecturerClassStatisticsResponse response = lecturerStatisticsService.getClassStatistics(1L, 1L);

        assertThat(response.totalStudents()).isEqualTo(2);
        assertThat(response.participatedStudents()).isEqualTo(1);
        assertThat(response.participationRate()).isEqualTo(50.0);
        
        assertThat(response.scoreDistribution()).hasSize(4);
        assertThat(response.scoreDistribution().get(0).count()).isEqualTo(1); // 1 Excellent (95)
        assertThat(response.scoreDistribution().get(2).count()).isEqualTo(1); // 1 Fair (70)

        assertThat(response.students()).hasSize(2);
    }

    @Test
    @DisplayName("getClassStatistics - success with no students")
    void getClassStatistics_noStudents() {
        when(userService.requireCurrentUserId()).thenReturn("l1");
        when(classRepository.findByIdAndLecturerEntityId(1L, "l1")).thenReturn(Optional.of(testClass));
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));
        when(studentRepository.findAllByClassEntityId(1L)).thenReturn(List.of());

        LecturerClassStatisticsResponse response = lecturerStatisticsService.getClassStatistics(1L, 1L);

        assertThat(response.totalStudents()).isEqualTo(0);
        assertThat(response.participatedStudents()).isEqualTo(0);
        assertThat(response.participationRate()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("getClassStatistics - active semester fallback")
    void getClassStatistics_activeSemester() {
        when(userService.requireCurrentUserId()).thenReturn("l1");
        when(classRepository.findByIdAndLecturerEntityId(1L, "l1")).thenReturn(Optional.of(testClass));
        when(semesterRepository.findFirstByIsActiveTrueOrderByStartDateDesc()).thenReturn(Optional.of(testSemester));
        when(studentRepository.findAllByClassEntityId(1L)).thenReturn(List.of());

        LecturerClassStatisticsResponse response = lecturerStatisticsService.getClassStatistics(1L, null);

        assertThat(response.semesterId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("exportClassStatisticsExcel - success")
    void exportClassStatisticsExcel_success() throws IOException {
        when(userService.requireCurrentUserId()).thenReturn("l1");
        when(classRepository.findByIdAndLecturerEntityId(1L, "l1")).thenReturn(Optional.of(testClass));
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));
        when(studentRepository.findAllByClassEntityId(1L)).thenReturn(List.of(testStudent1));

        StudentSemesterEntity eval1 = StudentSemesterEntity.builder().student(testStudent1).finalScore(85).build();
        when(studentSemesterRepository.findBySemester_IdAndStudent_IdIn(eq(1L), any()))
                .thenReturn(List.of(eval1));
        when(recordRepository.countEventJoinsBySemesterAndStudentIdsAndStatus(eq(1L), any(), eq(RecordStatus.APPROVED)))
                .thenReturn(List.of());

        byte[] excelBytes = lecturerStatisticsService.exportClassStatisticsExcel(1L, 1L);

        assertThat(excelBytes).isNotEmpty();
        
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(3);
            assertThat(workbook.getSheetName(0)).isEqualTo("TongQuan");
            assertThat(workbook.getSheetName(1)).isEqualTo("PhoDiem");
            assertThat(workbook.getSheetName(2)).isEqualTo("ChiTietSinhVien");
        }
    }

    @Test
    @DisplayName("getClassStatistics - forbidden access throws Exception")
    void getClassStatistics_forbidden() {
        when(userService.requireCurrentUserId()).thenReturn("l1");
        when(classRepository.findByIdAndLecturerEntityId(1L, "l1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> lecturerStatisticsService.getClassStatistics(1L, 1L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Bạn không có quyền xem thống kê lớp này");
    }
}
