package ct01.n06.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import ct01.n06.backend.dto.request.CreateSemesterRequest;
import ct01.n06.backend.dto.request.UpdateSemesterRequest;
import ct01.n06.backend.dto.response.SemesterResponse;
import ct01.n06.backend.entity.SemesterEntity;
import ct01.n06.backend.exception.business.ResourceNotFoundException;
import ct01.n06.backend.repository.SemesterRepository;
import ct01.n06.backend.service.impl.SemesterServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("SemesterServiceImpl Unit Tests")
class SemesterServiceImplTest {

    @Mock
    private SemesterRepository semesterRepository;

    @InjectMocks
    private SemesterServiceImpl semesterService;

    private SemesterEntity testSemester;

    @BeforeEach
    void setUp() {
        testSemester = SemesterEntity.builder()
                .id(1L)
                .name("HK1 2024")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusDays(90))
                .isActive(true)
                .build();
    }

    @Test
    @DisplayName("getAllSemesters - returns list of entities")
    void getAllSemesters_returnsList() {
        when(semesterRepository.findAll()).thenReturn(List.of(testSemester));

        List<SemesterEntity> list = semesterService.getAllSemesters();

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getName()).isEqualTo("HK1 2024");
    }

    @Test
    @DisplayName("getAllSemesterResponses - returns mapped list")
    void getAllSemesterResponses_returnsList() {
        when(semesterRepository.findAll()).thenReturn(List.of(testSemester));

        List<SemesterResponse> list = semesterService.getAllSemesterResponses();

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getSemesterById - success")
    void getSemesterById_success() {
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));

        SemesterEntity entity = semesterService.getSemesterById(1L);

        assertThat(entity.getId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getSemesterById - throws ResourceNotFoundException")
    void getSemesterById_notFound() {
        when(semesterRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> semesterService.getSemesterById(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    @Test
    @DisplayName("createSemester - success")
    void createSemester_success() {
        CreateSemesterRequest request = new CreateSemesterRequest();
        request.setName("HK2 2024");
        request.setStartDate(LocalDate.now());
        request.setEndDate(LocalDate.now().plusDays(90));
        request.setIsActive(true);

        when(semesterRepository.save(any(SemesterEntity.class))).thenReturn(testSemester);

        SemesterResponse response = semesterService.createSemester(request);

        assertThat(response).isNotNull();
        verify(semesterRepository).save(any(SemesterEntity.class));
    }

    @Test
    @DisplayName("updateSemester - success")
    void updateSemester_success() {
        UpdateSemesterRequest request = new UpdateSemesterRequest();
        request.setName("HK1 Updated");

        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));
        when(semesterRepository.save(any(SemesterEntity.class))).thenReturn(testSemester);

        SemesterResponse response = semesterService.updateSemester(1L, request);

        assertThat(response).isNotNull();
        verify(semesterRepository).save(any(SemesterEntity.class));
    }

    @Test
    @DisplayName("deleteSemester - success")
    void deleteSemester_success() {
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));

        semesterService.deleteSemester(1L);

        verify(semesterRepository).delete(testSemester);
    }

    @Test
    @DisplayName("toggleActive - success")
    void toggleActive_success() {
        when(semesterRepository.findById(1L)).thenReturn(Optional.of(testSemester));
        when(semesterRepository.save(any(SemesterEntity.class))).thenReturn(testSemester);

        SemesterResponse response = semesterService.toggleActive(1L);

        verify(semesterRepository).save(any(SemesterEntity.class));
    }
}
