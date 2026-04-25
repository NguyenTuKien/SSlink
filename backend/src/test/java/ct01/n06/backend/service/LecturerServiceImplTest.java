package ct01.n06.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.springframework.security.crypto.password.PasswordEncoder;

import ct01.n06.backend.dto.lecturer.LecturerDashboardSummaryResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentListResponse;
import ct01.n06.backend.dto.lecturer.LecturerStudentOptionsResponse;
import ct01.n06.backend.dto.lecturer.ManualCreateStudentRequest;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.FacultyEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.EventRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.RecordRepository;
import ct01.n06.backend.repository.SemesterRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.repository.StudentSemesterRepository;
import ct01.n06.backend.repository.UserRepository;
import ct01.n06.backend.service.impl.LecturerServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("LecturerServiceImpl Unit Tests")
class LecturerServiceImplTest {

    @Mock private LecturerRepository lecturerRepository;
    @Mock private ClassRepository classRepository;
    @Mock private StudentRepository studentRepository;
    @Mock private UserRepository userRepository;
    @Mock private SemesterRepository semesterRepository;
    @Mock private StudentSemesterRepository studentSemesterRepository;
    @Mock private EventRepository eventRepository;
    @Mock private RecordRepository recordRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserService userService;

    @InjectMocks
    private LecturerServiceImpl lecturerService;

    private UserEntity testUser;
    private LecturerEntity testLecturer;
    private ClassEntity testClass;
    private StudentEntity testStudent;
    private FacultyEntity testFaculty;

    @BeforeEach
    void setUp() {
        testUser = UserEntity.builder()
                .id("u1")
                .role(Role.ROLE_LECTURER)
                .status(UserStatus.ACTIVE)
                .build();
        testLecturer = LecturerEntity.builder()
                .id("l1")
                .userEntity(testUser)
                .build();
        testFaculty = FacultyEntity.builder()
                .id(1L)
                .code("F1")
                .build();
        testClass = ClassEntity.builder()
                .id(1L)
                .classCode("C1")
                .facultyEntity(testFaculty)
                .lecturerEntity(testLecturer)
                .build();
        UserEntity studentUser = UserEntity.builder()
                .id("su1")
                .email("student@test.com")
                .role(Role.ROLE_STUDENT)
                .status(UserStatus.ACTIVE)
                .build();
        testStudent = StudentEntity.builder()
                .id("s1")
                .userEntity(studentUser)
                .classEntity(testClass)
                .fullName("Student Test")
                .studentCode("SC1")
                .build();
    }

    @Test
    @DisplayName("ensureLecturerAccessForCurrentUser - success")
    void ensureLecturerAccessForCurrentUser_success() {
        when(userService.requireCurrentUser()).thenReturn(testUser);
        when(lecturerRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testLecturer));

        String lecturerId = lecturerService.ensureLecturerAccessForCurrentUser("l1");

        assertThat(lecturerId).isEqualTo("l1");
    }

    @Test
    @DisplayName("getOptions - returns correct options")
    void getOptions_returnsCorrectOptions() {
        when(lecturerRepository.findById("l1")).thenReturn(Optional.of(testLecturer));
        when(classRepository.findByLecturerEntityId("l1")).thenReturn(List.of(testClass));

        LecturerStudentOptionsResponse response = lecturerService.getOptions("l1");

        assertThat(response.faculties()).hasSize(1);
        assertThat(response.classes()).hasSize(1);
    }

    @Test
    @DisplayName("getDashboardSummary - success")
    void getDashboardSummary_success() {
        when(userService.requireCurrentUserId()).thenReturn("u1");
        when(userService.requireCurrentUser()).thenReturn(testUser);
        when(lecturerRepository.findByUserEntityId("u1")).thenReturn(Optional.of(testLecturer));
        
        when(studentRepository.findAllByLecturerIdWithDetails("l1")).thenReturn(List.of(testStudent));
        when(semesterRepository.findFirstByIsActiveTrueOrderByStartDateDesc()).thenReturn(Optional.empty());
        when(eventRepository.countByCreatedBy_Id("u1")).thenReturn(5L);

        LecturerDashboardSummaryResponse response = lecturerService.getDashboardSummary();

        assertThat(response.totalStudents()).isEqualTo(1);
        assertThat(response.totalEvents()).isEqualTo(5);
        assertThat(response.participatingStudents()).isEqualTo(0);
    }

    @Test
    @DisplayName("getStudents - success with no filters")
    void getStudents_success() {
        when(lecturerRepository.findById("l1")).thenReturn(Optional.of(testLecturer));
        when(studentRepository.findAllByLecturerIdWithDetails("l1")).thenReturn(List.of(testStudent));
        when(semesterRepository.findFirstByIsActiveTrueOrderByStartDateDesc()).thenReturn(Optional.empty());

        LecturerStudentListResponse response = lecturerService.getStudents("l1", null, null, null, null);

        assertThat(response.totalStudents()).isEqualTo(1);
        assertThat(response.students()).hasSize(1);
        assertThat(response.students().get(0).fullName()).isEqualTo("Student Test");
    }

    @Test
    @DisplayName("createManualStudent - success")
    void createManualStudent_success() {
        ManualCreateStudentRequest request = new ManualCreateStudentRequest(
                1L, "New Student", "new@test.com", "NSC1", "new_user", "password123"
        );

        when(classRepository.findByIdAndLecturerEntityId(1L, "l1")).thenReturn(Optional.of(testClass));
        when(userRepository.existsByEmailIgnoreCase("new@test.com")).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase("new_user")).thenReturn(false);
        when(studentRepository.findByStudentCodeIgnoreCase("NSC1")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        
        UserEntity savedUser = UserEntity.builder().id("u2").email("new@test.com").status(UserStatus.ACTIVE).build();
        when(userRepository.save(any())).thenReturn(savedUser);
        
        StudentEntity savedStudent = StudentEntity.builder().id("s2").fullName("New Student").studentCode("NSC1").userEntity(savedUser).classEntity(testClass).build();
        when(studentRepository.save(any())).thenReturn(savedStudent);

        var response = lecturerService.createManualStudent("l1", request);

        assertThat(response.fullName()).isEqualTo("New Student");
        verify(userRepository).save(any());
        verify(studentRepository).save(any());
    }

    @Test
    @DisplayName("deleteStudent - soft deletes user")
    void deleteStudent_success() {
        when(studentRepository.findById("s1")).thenReturn(Optional.of(testStudent));
        
        lecturerService.deleteStudent("l1", "s1");

        assertThat(testStudent.getUserEntity().getStatus()).isEqualTo(UserStatus.DELETED);
        verify(userRepository).save(testStudent.getUserEntity());
    }
}
