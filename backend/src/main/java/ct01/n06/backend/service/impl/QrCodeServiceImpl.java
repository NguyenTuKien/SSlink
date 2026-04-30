package ct01.n06.backend.service.impl;

import ct01.n06.backend.config.RabbitMQConfig;
import ct01.n06.backend.repository.AttendenceRepository;
import ct01.n06.backend.repository.EventRepository;
import ct01.n06.backend.repository.QrCodeRepository;
import ct01.n06.backend.repository.StudentRepository;
import ct01.n06.backend.service.QrCodeService;
import ct01.n06.backend.service.TotpService;
import ct01.n06.backend.constant.QrCodeConstant;
import ct01.n06.backend.dto.qrcode.CheckinByCodeRequest;
import ct01.n06.backend.dto.qrcode.GenerateQrResponse;
import ct01.n06.backend.dto.qrcode.ScanQrRequest;
import ct01.n06.backend.dto.qrcode.ScanTotpRequest;
import ct01.n06.backend.dto.qrcode.QrCheckinMessage;
import ct01.n06.backend.entity.AttendenceEntity;
import ct01.n06.backend.entity.EventEntity;
import ct01.n06.backend.entity.QrCodeEntity;
import ct01.n06.backend.entity.StudentEntity;
import ct01.n06.backend.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.UUID;

import static ct01.n06.backend.util.RandomUtil.generate6DigitPin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
public class QrCodeServiceImpl implements QrCodeService {

    private static final Logger log = LoggerFactory.getLogger(QrCodeServiceImpl.class);

    @Value("${app.qrcode.ttl-seconds:15}")
    private long qrTtlSeconds;

    @Value("${app.qrcode.pin-ttl-seconds:15}")
    private long pinTtlSeconds;

    private static final long TOTP_REPLAY_TTL_SECONDS = 60L;

    private final QrCodeRepository qrCodeRepository;
    private final EventRepository eventRepository;
    private final StudentRepository studentRepository;
    private final AttendenceRepository attendenceRepository;
    private final RabbitTemplate rabbitTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final TotpService totpService;

    @Override
    public GenerateQrResponse generateQr(Long eventId) {
        String token = UUID.randomUUID().toString();
        String pinCode = generateUniquePinCode(eventId);
        // String bluetoothId = UUID.randomUUID().toString(); // Temporarily disabled.

        QrCodeEntity qrcode = QrCodeEntity.builder()
                .qrToken(token)
                .eventId(eventId)
                .pinCode(pinCode)
                .bluetoothId(null)
                .timeToLive(qrTtlSeconds)
                .build();
                
        // Lưu vào Redis, cấu hình @TimeToLive sẽ tự động xóa sau TTL
        qrCodeRepository.save(qrcode);
        
        return GenerateQrResponse.builder()
                .qrToken(token)
                .pinCode(pinCode)
                .bluetoothId(null)
                .timeToLive(qrTtlSeconds)
                .build();
    }

    @Override
    @Transactional
    public void scanQr(ScanQrRequest request, String studentUserId, String deviceId) {
        String token = request.getQrData();
        if (token == null || token.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mã QR không hợp lệ");
        }
        if (request.getEventId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu eventId");
        }
        if (deviceId == null || deviceId.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu deviceId");
        }
        // if (request.getBlueToothId() == null || request.getBlueToothId().isEmpty()) {
        //     throw new ApiException(HttpStatus.BAD_REQUEST, "Bạn phải bật Bluetooth và ở gần giảng viên để điểm danh");
        // }

        String normalizedDeviceId = deviceId.trim();

        QrCodeEntity qrCode = qrCodeRepository.findById(token)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Mã QR đã hết hạn hoặc không hợp lệ"));

        if (!request.getEventId().equals(qrCode.getEventId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "eventId không khớp với mã QR");
        }
        StudentEntity student = studentRepository.findByUserEntityId(studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên"));
        // if (!qrCode.getBluetoothId().equals(request.getBlueToothId())) {
        //     log.warn("Bluetooth mismatch: expected={}, detected={}, student={}",
        //             qrCode.getBluetoothId(), request.getBlueToothId(), studentUserId);
        //     throw new ApiException(HttpStatus.FORBIDDEN, "Xác thực vị trí thất bại. Vui lòng lại gần giảng viên hơn.");
        // }
        performCheckin(qrCode.getEventId(), student, normalizedDeviceId);
    }

    @Override
    @Transactional
    public void checkinByCode(CheckinByCodeRequest request, String studentUserId, String deviceId) {
        if (request.getPinCode() == null || request.getPinCode().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu mã PIN");
        }
        if (deviceId == null || deviceId.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu deviceId");
        }

        String normalizedPin = request.getPinCode().trim();
        String normalizedDeviceId = deviceId.trim();

        String pinKey = buildPinKey(normalizedPin);
        String eventIdValue = stringRedisTemplate.opsForValue().get(pinKey);
        if (eventIdValue == null || eventIdValue.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mã PIN không tồn tại hoặc đã hết hạn");
        }

        Long eventId;
        try {
            eventId = Long.valueOf(eventIdValue.trim());
        } catch (NumberFormatException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mã PIN không tồn tại hoặc đã hết hạn");
        }

        StudentEntity student = studentRepository.findByUserEntityId(studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên"));

        performCheckin(eventId, student, normalizedDeviceId);
    }

    @Override
    @Transactional
    public void scanTotp(ScanTotpRequest request, String studentUserId, String deviceId) {
        if (request.getEventId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu eventId");
        }
        if (request.getTotp() == null || request.getTotp().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu mã TOTP");
        }
        if (deviceId == null || deviceId.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Thiếu deviceId");
        }

        String normalizedDeviceId = deviceId.trim();

        StudentEntity student = studentRepository.findByUserEntityId(studentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài khoản của bạn chưa được liên kết với hồ sơ sinh viên"));

        String secretKey = student.getUserEntity().getTotpSecret();
        if (secretKey == null || secretKey.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài khoản chưa được cấp secret TOTP");
        }
        OptionalLong validStep = totpService.validateTotpWithDrift(secretKey, request.getTotp().trim());
        if (validStep.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mã TOTP không hợp lệ hoặc đã hết hạn");
        }

        String replayKey = buildTotpReplayKey(studentUserId, request.getEventId(), validStep.getAsLong());
        Boolean accepted = stringRedisTemplate.opsForValue()
                .setIfAbsent(replayKey, request.getTotp().trim(), Duration.ofSeconds(TOTP_REPLAY_TTL_SECONDS));
        if (!Boolean.TRUE.equals(accepted)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mã TOTP đã được sử dụng");
        }

        performCheckin(request.getEventId(), student, normalizedDeviceId);
    }

    private void performCheckin(Long eventId, StudentEntity student, String deviceId) {

        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy sự kiện"));

        LocalDateTime now = LocalDateTime.now();
        Duration ttlDuration = Duration.between(now, event.getEndTime());
        if (ttlDuration.isZero() || ttlDuration.isNegative()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Sự kiện đã kết thúc, không thể điểm danh");
        }

        validateStudentClassForClassMeeting(event, student);

        Optional<AttendenceEntity> existing = attendenceRepository.findByEventIdAndStudentId(eventId, student.getId());
        if (existing.isPresent()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Bạn đã điểm danh sự kiện này rồi!");
        }

        // Yêu cầu 3: Ràng buộc Device - Event (Chống mượn máy điểm danh)
        String finalDeviceLockKey = QrCodeConstant.REDIS_DEVICE_LOCK_PREFIX + event.getId() + ":" + deviceId;
        Duration lockTtl = ttlDuration;
        
        Boolean finalLockAcquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(finalDeviceLockKey, student.getId(), lockTtl);
        if (!Boolean.TRUE.equals(finalLockAcquired)) {
            log.info("Check-in blocked by device lock: eventId={}, studentId={}, deviceId={}", eventId, student.getId(), deviceId);
            throw new ApiException(HttpStatus.FORBIDDEN, "Thiết bị này đã được sử dụng để điểm danh cho sự kiện này!");
        }

        QrCheckinMessage message = QrCheckinMessage.builder()
                .eventId(event.getId())
                .studentId(student.getId())
                .deviceId(deviceId)
                .build();

        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, message);
        } catch (Exception ex) {
            String currentValue = stringRedisTemplate.opsForValue().get(finalDeviceLockKey);
            if (student.getId().equals(currentValue)) {
                stringRedisTemplate.delete(finalDeviceLockKey);
            }
            log.error("Check-in enqueue failed: eventId={}, studentId={}, deviceId={}", eventId, student.getId(), deviceId, ex);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Hệ thống đang bận, vui lòng thử lại");
        }
    }

    private void validateStudentClassForClassMeeting(EventEntity event, StudentEntity student) {
        if (!isClassMeetingEvent(event)) {
            return;
        }

        String eventClassCode = normalizeText(event.getOrganizer());
        if (eventClassCode.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Sự kiện họp lớp chưa được gán lớp tổ chức");
        }

        String studentClassCode = student.getClassEntity() == null
                ? ""
                : normalizeText(student.getClassEntity().getClassCode());

        if (!eventClassCode.equals(studentClassCode)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sinh viên không thuộc lớp đó");
        }
    }

    private boolean isClassMeetingEvent(EventEntity event) {
        if (event == null || event.getCriteria() == null) {
            return false;
        }

        String criteriaName = normalizeText(event.getCriteria().getName());
        String criteriaCode = normalizeText(event.getCriteria().getCode());

        return criteriaName.contains("họp lớp")
                || criteriaName.contains("hop lop")
                || "2.4".equals(criteriaCode);
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String generateUniquePinCode(Long eventId) {
        for (int attempt = 0; attempt < 10; attempt++) {
            String pinCode = generate6DigitPin();
            String pinKey = buildPinKey(pinCode);
            Boolean registered = stringRedisTemplate.opsForValue()
                    .setIfAbsent(pinKey, String.valueOf(eventId), Duration.ofSeconds(pinTtlSeconds));
            if (Boolean.TRUE.equals(registered)) {
                return pinCode;
            }
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Lỗi tạo mã PIN, vui lòng thử lại");
    }

    private String buildPinKey(String pinCode) {
        return QrCodeConstant.REDIS_PIN_PREFIX + pinCode;
    }

    private String buildTotpReplayKey(String studentUserId, Long eventId, long timeStep) {
        return QrCodeConstant.REDIS_TOTP_REPLAY_PREFIX + studentUserId + ":" + eventId + ":" + timeStep;
    }
}
