package ct01.n06.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

import ct01.n06.backend.dto.admin.AdminStudentCreateRequest;
import ct01.n06.backend.dto.admin.AdminStudentListResponse;
import ct01.n06.backend.dto.admin.AdminStudentOptionsResponse;
import ct01.n06.backend.dto.admin.AdminStudentRowResponse;
import ct01.n06.backend.dto.admin.AdminStudentStatsResponse;
import ct01.n06.backend.dto.admin.AdminStudentUpdateRequest;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.FacultyEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.FacultyRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.repository.UserRepository;
import ct01.n06.backend.service.impl.AdminStudentServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminStudentServiceImpl Unit Tests")
class AdminStudentServiceImplTest {

    @Mock
    private StudentRepository studentRepository;
    @Mock
    private ClassRepository classRepository;
    @Mock
    private FacultyRepository facultyRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminStudentServiceImpl adminStudentService;

    private StudentEntity testStudent;
    private UserEntity testUser;
    private FacultyEntity testFaculty;
    private ClassEntity testClass;

    @BeforeEach
    void setUp() {
        testUser = UserEntity.builder()
                .id("u1")
                .username("sv_test")
                .email("sv@test.com")
                .password("hashed_pwd")
                .role(Role.ROLE_STUDENT)
                .status(UserStatus.ACTIVE)
                .build();
        testUser.setCreatedAt(LocalDateTime.now());

        testFaculty = FacultyEntity.builder()
                .id(1L)
                .code("CNTT")
                .name("Công nghệ thông tin")
                .build();

        testClass = ClassEntity.builder()
                .id(1L)
                .classCode("D23CQCN01")
                .facultyEntity(testFaculty)
                .build();

        testStudent = StudentEntity.builder()
                .id("s1")
                .studentCode("B23DCCN001")
                .fullName("Sinh Viên Test")
                .userEntity(testUser)
                .classEntity(testClass)
                .build();
    }

    @Test
    @DisplayName("getOptions - returns faculties and classes")
    void getOptions_returnsOptions() {
        when(facultyRepository.findAllByOrderByCodeAsc()).thenReturn(List.of(testFaculty));
        when(classRepository.findAllByOrderByClassCodeAsc()).thenReturn(List.of(testClass));

        AdminStudentOptionsResponse response = adminStudentService.getOptions();

        assertThat(response.faculties()).hasSize(1);
        assertThat(response.faculties().get(0).code()).isEqualTo("CNTT");
        
        assertThat(response.classes()).hasSize(1);
        assertThat(response.classes().get(0).classCode()).isEqualTo("D23CQCN01");
    }

    @Test
    @DisplayName("getStudents - returns filtered list")
    void getStudents_returnsFilteredList() {
        when(studentRepository.findAllByOrderByFullNameAsc()).thenReturn(List.of(testStudent));

        AdminStudentListResponse response = adminStudentService.getStudents(1L, 1L, "ACTIVE", "SV");

        assertThat(response.totalStudents()).isEqualTo(1);
        assertThat(response.activeStudents()).isEqualTo(1);
        assertThat(response.students()).hasSize(1);
        assertThat(response.students().get(0).fullName()).isEqualTo("Sinh Viên Test");
        assertThat(response.students().get(0).classCode()).isEqualTo("D23CQCN01");
    }

    @Test
    @DisplayName("getStats - returns comprehensive stats")
    void getStats_returnsStats() {
        when(studentRepository.findAllByOrderByFullNameAsc()).thenReturn(List.of(testStudent));
        when(classRepository.findAllByOrderByClassCodeAsc()).thenReturn(List.of(testClass));

        AdminStudentStatsResponse response = adminStudentService.getStats();

        assertThat(response.totalStudents()).isEqualTo(1);
        assertThat(response.activeStudents()).isEqualTo(1);
        assertThat(response.totalFaculties()).isEqualTo(1);
        assertThat(response.totalClasses()).isEqualTo(1);
        assertThat(response.recentStudents()).hasSize(1);
        assertThat(response.facultyBreakdown()).hasSize(1);
        assertThat(response.classBreakdown()).hasSize(1);
        assertThat(response.facultyBreakdown().get(0).studentCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("createStudent - success")
    void createStudent_success() {
        AdminStudentCreateRequest request = new AdminStudentCreateRequest(
                "Nguyễn Văn B", "B23DCCN002", "nvb@test.com", "nvb", "pwd123", 1L, "STUDENT", "ACTIVE"
        );

        when(classRepository.findById(1L)).thenReturn(Optional.of(testClass));
        when(userRepository.existsByEmailIgnoreCase("nvb@test.com")).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase("nvb")).thenReturn(false);
        when(studentRepository.findByStudentCodeIgnoreCase("B23DCCN002")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("pwd123")).thenReturn("encoded_pwd");
        
        UserEntity savedUser = UserEntity.builder().id("u2").email("nvb@test.com").status(UserStatus.ACTIVE).build();
        when(userRepository.save(any())).thenReturn(savedUser);
        
        StudentEntity savedStudent = StudentEntity.builder().id("s2").studentCode("B23DCCN002").fullName("Nguyễn Văn B").userEntity(savedUser).build();
        when(studentRepository.save(any())).thenReturn(savedStudent);

        AdminStudentRowResponse response = adminStudentService.createStudent(request);

        assertThat(response.fullName()).isEqualTo("Nguyễn Văn B");
        verify(userRepository).save(any());
        verify(studentRepository).save(any());
    }

    @Test
    @DisplayName("createStudent - missing required fields throws Exception")
    void createStudent_missingFields_throwsException() {
        AdminStudentCreateRequest request = new AdminStudentCreateRequest(
                null, "Nguyễn Văn B", "nvb@test.com", "nvb", "pwd123", 1L, "STUDENT", "ACTIVE"
        );
        assertThatThrownBy(() -> adminStudentService.createStudent(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Thiếu thông tin bắt buộc");
    }

    @Test
    @DisplayName("updateStudent - success")
    void updateStudent_success() {
        AdminStudentUpdateRequest request = new AdminStudentUpdateRequest(
                "Sinh Viên Cập Nhật", "B23DCCN001_NEW", "sv_new@test.com", "sv_new", "new_pwd", 1L, "MONITOR", "LOCKED"
        );

        when(studentRepository.findById("s1")).thenReturn(Optional.of(testStudent));
        when(classRepository.findById(1L)).thenReturn(Optional.of(testClass));
        when(passwordEncoder.encode("new_pwd")).thenReturn("encoded_new");
        when(userRepository.save(any())).thenReturn(testUser);
        when(studentRepository.save(any())).thenReturn(testStudent);

        AdminStudentRowResponse response = adminStudentService.updateStudent("s1", request);

        assertThat(response.fullName()).isEqualTo("Sinh Viên Cập Nhật");
        assertThat(testUser.getRole()).isEqualTo(Role.ROLE_MONITOR);
        verify(userRepository).save(any());
        verify(studentRepository).save(any());
    }

    @Test
    @DisplayName("deleteStudent - success")
    void deleteStudent_success() {
        when(studentRepository.findById("s1")).thenReturn(Optional.of(testStudent));
        
        adminStudentService.deleteStudent("s1");

        assertThat(testUser.getStatus()).isEqualTo(UserStatus.DELETED);
        verify(userRepository).save(testUser);
    }

    @Test
    @DisplayName("deleteStudent - not found throws Exception")
    void deleteStudent_notFound_throwsException() {
        when(studentRepository.findById("invalid")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminStudentService.deleteStudent("invalid"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Không tìm thấy sinh viên");
    }
}
