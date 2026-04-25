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

import ct01.n06.backend.dto.admin.AdminLecturerCreateRequest;
import ct01.n06.backend.dto.admin.AdminLecturerListResponse;
import ct01.n06.backend.dto.admin.AdminLecturerOptionsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerRowResponse;
import ct01.n06.backend.dto.admin.AdminLecturerStatsResponse;
import ct01.n06.backend.dto.admin.AdminLecturerUpdateRequest;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.FacultyEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.Role;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.FacultyRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.UserRepository;
import ct01.n06.backend.service.impl.AdminLecturerServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminLecturerServiceImpl Unit Tests")
class AdminLecturerServiceImplTest {

    @Mock
    private LecturerRepository lecturerRepository;
    @Mock
    private FacultyRepository facultyRepository;
    @Mock
    private ClassRepository classRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminLecturerServiceImpl adminLecturerService;

    private LecturerEntity testLecturer;
    private UserEntity testUser;
    private FacultyEntity testFaculty;
    private ClassEntity testClass;

    @BeforeEach
    void setUp() {
        testUser = UserEntity.builder()
                .id("u1")
                .username("gv_test")
                .email("gv@test.com")
                .password("hashed_pwd")
                .role(Role.ROLE_LECTURER)
                .status(UserStatus.ACTIVE)
                .build();
        testUser.setCreatedAt(LocalDateTime.now());

        testFaculty = FacultyEntity.builder()
                .id(1L)
                .code("CNTT")
                .name("Công nghệ thông tin")
                .build();

        testLecturer = LecturerEntity.builder()
                .id("l1")
                .lecturerCode("GV01")
                .fullName("Giảng Viên Test")
                .userEntity(testUser)
                .facultyEntity(testFaculty)
                .build();

        testClass = ClassEntity.builder()
                .id(1L)
                .classCode("D23CQCN01")
                .facultyEntity(testFaculty)
                .lecturerEntity(testLecturer)
                .build();
    }

    @Test
    @DisplayName("getOptions - returns faculties and classes")
    void getOptions_returnsOptions() {
        when(facultyRepository.findAllByOrderByCodeAsc()).thenReturn(List.of(testFaculty));
        when(classRepository.findAllByOrderByClassCodeAsc()).thenReturn(List.of(testClass));

        AdminLecturerOptionsResponse response = adminLecturerService.getOptions();

        assertThat(response.faculties()).hasSize(1);
        assertThat(response.faculties().get(0).code()).isEqualTo("CNTT");
        
        assertThat(response.classes()).hasSize(1);
        assertThat(response.classes().get(0).classCode()).isEqualTo("D23CQCN01");
        assertThat(response.classes().get(0).lecturerName()).isEqualTo("Giảng Viên Test");
    }

    @Test
    @DisplayName("getLecturers - returns filtered list")
    void getLecturers_returnsFilteredList() {
        when(lecturerRepository.findAllByUserEntity_Role(Role.ROLE_LECTURER)).thenReturn(List.of(testLecturer));
        when(classRepository.findAll()).thenReturn(List.of(testClass));

        AdminLecturerListResponse response = adminLecturerService.getLecturers(1L, "ACTIVE", "GV");

        assertThat(response.totalLecturers()).isEqualTo(1);
        assertThat(response.activeLecturers()).isEqualTo(1);
        assertThat(response.lecturers()).hasSize(1);
        assertThat(response.lecturers().get(0).fullName()).isEqualTo("Giảng Viên Test");
        assertThat(response.lecturers().get(0).classCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("getStats - returns comprehensive stats")
    void getStats_returnsStats() {
        when(lecturerRepository.findAllByUserEntity_Role(Role.ROLE_LECTURER)).thenReturn(List.of(testLecturer));
        when(classRepository.findAll()).thenReturn(List.of(testClass));
        when(classRepository.countByLecturerEntityIsNotNull()).thenReturn(1L);
        when(facultyRepository.count()).thenReturn(1L);

        AdminLecturerStatsResponse response = adminLecturerService.getStats();

        assertThat(response.totalLecturers()).isEqualTo(1);
        assertThat(response.activeLecturers()).isEqualTo(1);
        assertThat(response.totalFaculties()).isEqualTo(1);
        assertThat(response.assignedClasses()).isEqualTo(1);
        assertThat(response.unassignedLecturers()).isEqualTo(0);
        assertThat(response.recentLecturers()).hasSize(1);
        assertThat(response.facultyBreakdown()).hasSize(1);
        assertThat(response.facultyBreakdown().get(0).lecturerCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("createLecturer - success")
    void createLecturer_success() {
        AdminLecturerCreateRequest request = new AdminLecturerCreateRequest(
                "Nguyễn Văn A", "GV02", "nva@test.com", "nva", "pwd123", 1L, List.of(1L), "ACTIVE"
        );

        when(facultyRepository.findById(1L)).thenReturn(Optional.of(testFaculty));
        when(userRepository.existsByEmailIgnoreCase("nva@test.com")).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase("nva")).thenReturn(false);
        when(lecturerRepository.existsByLecturerCodeIgnoreCase("GV02")).thenReturn(false);
        when(passwordEncoder.encode("pwd123")).thenReturn("encoded_pwd");
        
        UserEntity savedUser = UserEntity.builder().id("u2").email("nva@test.com").status(UserStatus.ACTIVE).build();
        when(userRepository.save(any())).thenReturn(savedUser);
        
        LecturerEntity savedLecturer = LecturerEntity.builder().id("l2").lecturerCode("GV02").fullName("Nguyễn Văn A").userEntity(savedUser).build();
        when(lecturerRepository.save(any())).thenReturn(savedLecturer);
        when(classRepository.findByLecturerEntityId("l2")).thenReturn(List.of());
        when(classRepository.findAllById(List.of(1L))).thenReturn(List.of(testClass));

        AdminLecturerRowResponse response = adminLecturerService.createLecturer(request);

        assertThat(response.fullName()).isEqualTo("Nguyễn Văn A");
        verify(userRepository).save(any());
        verify(lecturerRepository).save(any());
        verify(classRepository).saveAll(any());
    }

    @Test
    @DisplayName("createLecturer - missing required fields throws Exception")
    void createLecturer_missingFields_throwsException() {
        AdminLecturerCreateRequest request = new AdminLecturerCreateRequest(
                null, "Nguyễn Văn A", "nva@test.com", "nva", "pwd123", 1L, List.of(), "ACTIVE"
        );
        assertThatThrownBy(() -> adminLecturerService.createLecturer(request))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Thiếu thông tin bắt buộc");
    }

    @Test
    @DisplayName("updateLecturer - success")
    void updateLecturer_success() {
        AdminLecturerUpdateRequest request = new AdminLecturerUpdateRequest(
                "Giảng Viên Cập Nhật", "GV01_NEW", "gv_new@test.com", "gv_new", "new_pwd", 1L, List.of(), "LOCKED"
        );

        when(lecturerRepository.findById("l1")).thenReturn(Optional.of(testLecturer));
        when(facultyRepository.findById(1L)).thenReturn(Optional.of(testFaculty));
        when(passwordEncoder.encode("new_pwd")).thenReturn("encoded_new");
        when(userRepository.save(any())).thenReturn(testUser);
        when(lecturerRepository.save(any())).thenReturn(testLecturer);

        AdminLecturerRowResponse response = adminLecturerService.updateLecturer("l1", request);

        assertThat(response.fullName()).isEqualTo("Giảng Viên Cập Nhật");
        verify(userRepository).save(any());
        verify(lecturerRepository).save(any());
    }

    @Test
    @DisplayName("deleteLecturer - success")
    void deleteLecturer_success() {
        when(lecturerRepository.findById("l1")).thenReturn(Optional.of(testLecturer));
        
        adminLecturerService.deleteLecturer("l1");

        assertThat(testUser.getStatus()).isEqualTo(UserStatus.DELETED);
        verify(userRepository).save(testUser);
    }

    @Test
    @DisplayName("deleteLecturer - not found throws Exception")
    void deleteLecturer_notFound_throwsException() {
        when(lecturerRepository.findById("invalid")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminLecturerService.deleteLecturer("invalid"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Không tìm thấy giảng viên");
    }
}
