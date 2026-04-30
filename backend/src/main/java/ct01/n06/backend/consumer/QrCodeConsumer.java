package ct01.n06.backend.consumer;

import ct01.n06.backend.config.RabbitMQConfig;
import ct01.n06.backend.repository.AttendenceRepository;
import ct01.n06.backend.repository.EventRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.dto.qrcode.QrCheckinMessage;
import ct01.n06.backend.entity.AttendenceEntity;
import ct01.n06.backend.entity.EventEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.constant.QrCodeConstant;
import ct01.n06.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class QrCodeConsumer {

    private final AttendenceRepository attendenceRepository;
    private final EventRepository eventRepository;
    private final StudentRepository studentRepository;
    private final StringRedisTemplate stringRedisTemplate;
    private final NotificationService notificationService;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    public void processQrCheckin(QrCheckinMessage message) {

        Long eventId = message.getEventId();
        String studentId = message.getStudentId();
        String deviceId = message.getDeviceId();

        if (eventId == null || studentId == null || studentId.trim().isEmpty()) {
            log.warn("Thiếu eventId hoặc studentId trong message check-in: studentId={}, eventId={}", studentId, eventId);
            return;
        }
        if (deviceId == null || deviceId.trim().isEmpty()) {
            log.warn("Thiếu deviceId trong message check-in: studentId={}, eventId={}", studentId, eventId);
            return;
        }

        String normalizedDeviceId = deviceId.trim();

        EventEntity event = eventRepository.findById(eventId).orElse(null);
        StudentEntity student = studentRepository.findById(studentId).orElse(null);
        if (event == null || student == null) {
            log.error("Không tìm thấy dữ liệu: studentId={}, eventId={}", studentId, eventId);
            return;
        }

        Duration ttlDuration = Duration.between(LocalDateTime.now(), event.getEndTime());
        if (ttlDuration.isZero() || ttlDuration.isNegative()) {
            log.warn("Sự kiện đã kết thúc, bỏ qua check-in: studentId={}, eventId={}", studentId, eventId);
            return;
        }

        String processingLockKey = "event_checkin_processing:" + eventId + ":device:" + normalizedDeviceId;
        String processingLockValue = UUID.randomUUID().toString();

        Boolean processingLocked = stringRedisTemplate.opsForValue()
                .setIfAbsent(processingLockKey, processingLockValue, Duration.ofSeconds(20));

        if (!Boolean.TRUE.equals(processingLocked)) {
            log.warn("Đang có request khác xử lý cùng thiết bị: eventId={}, deviceId={}", eventId, normalizedDeviceId);
            return;
        }

        // Must match key format from QrCodeServiceImpl.performCheckin(...)
        String finalDeviceLockKey = QrCodeConstant.REDIS_DEVICE_LOCK_PREFIX + eventId + ":" + normalizedDeviceId;
        String finalDeviceLockValue = studentId;

        log.info("Nhận message check-in: studentId={}, eventId={}, deviceId={}", studentId, eventId, normalizedDeviceId);

        try {
            boolean existed = attendenceRepository.existsByEventIdAndStudentId(eventId, studentId);
            if (existed) {
                log.warn("Đã tồn tại check-in trong DB: studentId={}, eventId={}", studentId, eventId);
                return;
            }

            String currentDeviceLockValue = stringRedisTemplate.opsForValue().get(finalDeviceLockKey);
            if (!Objects.equals(finalDeviceLockValue, currentDeviceLockValue)) {
                log.warn("Thiết bị đã được dùng để điểm danh trong sự kiện này: eventId={}, deviceId={}", eventId,
                        normalizedDeviceId);
                return;
            }

            AttendenceEntity attendence = AttendenceEntity.builder()
                    .event(event)
                    .student(student)
                    .build();

            try {
                attendenceRepository.save(attendence);
            } catch (Exception e) {
                String currentFinalValue = stringRedisTemplate.opsForValue().get(finalDeviceLockKey);
                if (Objects.equals(finalDeviceLockValue, currentFinalValue)) {
                    stringRedisTemplate.delete(finalDeviceLockKey);
                }
                throw e;
            }

            try {
                notificationService.createStudentCheckinNotification(student, event);
            } catch (Exception e) {
                log.warn("Không thể gửi thông báo check-in: studentId={}, eventId={}", studentId, eventId, e);
            }

            log.info("Check-in thành công: studentId={}, eventId={}, deviceId={}", studentId, eventId,
                    normalizedDeviceId);

        } catch (Exception e) {
            log.error("Lỗi xử lý check-in queue", e);

        } finally {
            try {
                String currentValue = stringRedisTemplate.opsForValue().get(processingLockKey);
                if (Objects.equals(processingLockValue, currentValue)) {
                    stringRedisTemplate.delete(processingLockKey);
                }
            } catch (Exception e) {
                log.error("Lỗi khi release processing lock", e);
            }
        }
    }
}
