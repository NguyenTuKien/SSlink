package ct01.n06.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import ct01.n06.backend.dto.common.SimpleMessageResponse;
import ct01.n06.backend.dto.lecturer.CreateLecturerNotificationRequest;
import ct01.n06.backend.dto.lecturer.LecturerNotificationCreateResponse;
import ct01.n06.backend.dto.student.StudentNotificationListResponse;
import ct01.n06.backend.dto.student.StudentNotificationUnreadResponse;
import ct01.n06.backend.entity.ClassEntity;
import ct01.n06.backend.entity.EventEntity;
import ct01.n06.backend.entity.LecturerEntity;
import ct01.n06.backend.entity.NotificationEntity;
import ct01.n06.backend.entity.NotificationRecipientEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.entity.UserEntity;
import ct01.n06.backend.entity.enums.NotificationType;
import ct01.n06.backend.entity.enums.UserStatus;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.repository.ClassRepository;
import ct01.n06.backend.repository.LecturerRepository;
import ct01.n06.backend.repository.NotificationRecipientRepository;
import ct01.n06.backend.repository.NotificationRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.service.impl.NotificationServiceImpl;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationServiceImpl Unit Tests")
class NotificationServiceImplTest {

    @Mock private UserService userService;
    @Mock private StudentRepository studentRepository;
    @Mock private ClassRepository classRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationRecipientRepository notificationRecipientRepository;
    @Mock private LecturerRepository lecturerRepository;
    @Mock private EmailQueueService emailQueueService;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    @TempDir
    Path tempDir;

    private UserEntity testLecturerUser;
    private UserEntity testStudentUser;
    private StudentEntity testStudent;
    private ClassEntity testClass;
    private NotificationEntity testNotification;
    private NotificationRecipientEntity testRecipient;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(notificationService, "attachmentDirectory", tempDir.toString());
        ReflectionTestUtils.setField(notificationService, "maxAttachmentSizeBytes", 10485760L);

        testLecturerUser = UserEntity.builder()
                .id("u1")
                .email("lecturer@test.com")
                .username("gv_test")
                .status(UserStatus.ACTIVE)
                .build();

        testStudentUser = UserEntity.builder()
                .id("u2")
                .email("student@test.com")
                .status(UserStatus.ACTIVE)
                .build();

        testClass = ClassEntity.builder()
                .id(1L)
                .classCode("C1")
                .build();

        testStudent = StudentEntity.builder()
                .id("s1")
                .fullName("Sinh Vien Test")
                .userEntity(testStudentUser)
                .classEntity(testClass)
                .build();

        testNotification = NotificationEntity.builder()
                .id(1L)
                .title("Thông báo test")
                .content("Nội dung")
                .targetType(NotificationType.CLASS)
                .classEntity(testClass)
                .sender(testLecturerUser)
                .build();
        testNotification.setCreatedAt(LocalDateTime.now());

        testRecipient = NotificationRecipientEntity.builder()
                .id(1L)
                .notification(testNotification)
                .student(testStudent)
                .read(false)
                .build();
    }

    @Test
    @DisplayName("createLecturerNotification - success without file")
    void createLecturerNotification_success() {
        CreateLecturerNotificationRequest request = new CreateLecturerNotificationRequest(
                "Tiêu đề", "Nội dung", NotificationType.CLASS, 1L
        );

        when(userService.requireCurrentUser()).thenReturn(testLecturerUser);
        when(classRepository.findByIdAndLecturerEntityId(1L, "u1")).thenReturn(Optional.of(testClass));
        when(studentRepository.findAllByClassEntityId(1L)).thenReturn(List.of(testStudent));
        
        when(notificationRepository.save(any())).thenReturn(testNotification);

        LecturerNotificationCreateResponse response = notificationService.createLecturerNotification(request, null);

        assertThat(response.totalRecipients()).isEqualTo(1);
        verify(notificationRepository).save(any());
        verify(notificationRecipientRepository).saveAll(any());
        // verify emailQueueService ? Transactional listener makes it hard, but it doesn't crash
    }

    @Test
    @DisplayName("createLecturerNotification - missing data throws Exception")
    void createLecturerNotification_missingData() {
        assertThatThrownBy(() -> notificationService.createLecturerNotification(null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Thiếu dữ liệu");

        CreateLecturerNotificationRequest req2 = new CreateLecturerNotificationRequest(
                "", "Nội dung", NotificationType.CLASS, 1L
        );
        when(userService.requireCurrentUser()).thenReturn(testLecturerUser);
        assertThatThrownBy(() -> notificationService.createLecturerNotification(req2, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Tiêu đề không được để trống");
    }

    @Test
    @DisplayName("createLecturerNotification - success with file")
    void createLecturerNotification_withFile_success() throws IOException {
        CreateLecturerNotificationRequest request = new CreateLecturerNotificationRequest(
                "Tiêu đề", "Nội dung", NotificationType.ALL, null
        );

        when(userService.requireCurrentUser()).thenReturn(testLecturerUser);
        when(studentRepository.findAllByOrderByFullNameAsc()).thenReturn(List.of(testStudent));
        when(notificationRepository.save(any())).thenReturn(testNotification);

        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(100L);
        when(file.getOriginalFilename()).thenReturn("test.txt");
        when(file.getInputStream()).thenReturn(new ByteArrayInputStream("test".getBytes()));

        LecturerNotificationCreateResponse response = notificationService.createLecturerNotification(request, file);

        assertThat(response.totalRecipients()).isEqualTo(1);
    }

    @Test
    @DisplayName("getStudentNotifications - success")
    void getStudentNotifications_success() {
        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testStudent));
        
        Page<NotificationRecipientEntity> page = new PageImpl<>(List.of(testRecipient));
        when(notificationRecipientRepository.findByStudent_IdOrderByCreatedAtDesc(anyString(), any(PageRequest.class)))
                .thenReturn(page);
        when(notificationRecipientRepository.countByStudent_IdAndReadFalse("s1")).thenReturn(1L);

        StudentNotificationListResponse response = notificationService.getStudentNotifications("u2", 0, 10);

        assertThat(response.totalItems()).isEqualTo(1);
        assertThat(response.unreadCount()).isEqualTo(1);
        assertThat(response.items()).hasSize(1);
    }

    @Test
    @DisplayName("getStudentUnreadCount - success")
    void getStudentUnreadCount_success() {
        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testStudent));
        when(notificationRecipientRepository.countByStudent_IdAndReadFalse("s1")).thenReturn(5L);

        StudentNotificationUnreadResponse response = notificationService.getStudentUnreadCount("u2");

        assertThat(response.unreadCount()).isEqualTo(5);
    }

    @Test
    @DisplayName("markAsRead - success")
    void markAsRead_success() {
        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testStudent));
        when(notificationRecipientRepository.findByIdAndStudent_Id(1L, "s1")).thenReturn(Optional.of(testRecipient));

        SimpleMessageResponse response = notificationService.markAsRead("u2", 1L);

        assertThat(response.message()).contains("Đã đánh dấu");
        assertThat(testRecipient.isRead()).isTrue();
        verify(notificationRecipientRepository).save(testRecipient);
    }

    @Test
    @DisplayName("markAsRead - not found throws exception")
    void markAsRead_notFound() {
        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testStudent));
        when(notificationRecipientRepository.findByIdAndStudent_Id(1L, "s1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markAsRead("u2", 1L))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Không tìm thấy");
    }

    @Test
    @DisplayName("getStudentAttachment - success")
    void getStudentAttachment_success() throws IOException {
        Path fakeFile = tempDir.resolve("test.txt");
        Files.writeString(fakeFile, "content");
        
        testNotification.setAttachmentPath(fakeFile.toString());
        testNotification.setAttachmentName("test.txt");

        when(studentRepository.findByUserEntityId("u2")).thenReturn(Optional.of(testStudent));
        when(notificationRecipientRepository.findByIdAndStudent_Id(1L, "s1")).thenReturn(Optional.of(testRecipient));

        NotificationService.NotificationAttachment attachment = notificationService.getStudentAttachment("u2", 1L);

        assertThat(attachment.fileName()).isEqualTo("test.txt");
        assertThat(attachment.filePath()).isEqualTo(fakeFile);
    }

    @Test
    @DisplayName("createStudentCheckinNotification - success")
    void createStudentCheckinNotification_success() {
        EventEntity event = EventEntity.builder().id(1L).title("Sự kiện Test").build();
        when(studentRepository.findById("s1")).thenReturn(Optional.of(testStudent));
        when(notificationRepository.save(any())).thenReturn(testNotification);

        notificationService.createStudentCheckinNotification(testStudent, event);

        verify(notificationRepository).save(any());
        verify(notificationRecipientRepository).save(any());
        // Verify email enqueuing handles no-transaction graceful fallback
    }
}
