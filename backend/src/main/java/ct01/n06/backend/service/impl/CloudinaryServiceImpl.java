package ct01.n06.backend.service.impl;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import ct01.n06.backend.exception.ApiException;
import ct01.n06.backend.service.CloudinaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class CloudinaryServiceImpl implements CloudinaryService {

    private static final long MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif"
    );

    private final Cloudinary cloudinary;

    @Override
    public String uploadImage(MultipartFile file, String folder) {
        validateFile(file);

        try {
            byte[] fileBytes = file.getBytes();

            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(fileBytes, ObjectUtils.asMap(
                    "folder",               folder,
                    "resource_type",        "image",
                    "use_filename",         false,
                    "unique_filename",      true,
                    "overwrite",            false
            ));

            String secureUrl = (String) result.get("secure_url");
            log.info("Cloudinary upload success: public_id={}, url={}",
                    result.get("public_id"), secureUrl);
            return secureUrl;

        } catch (IOException e) {
            log.error("Cloudinary upload failed: {}", e.getMessage(), e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể upload ảnh lên Cloudinary. Vui lòng thử lại.");
        }
    }

    @Override
    public void deleteImage(String publicId) {
        if (publicId == null || publicId.isBlank()) return;
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
            log.info("Cloudinary delete success: public_id={}", publicId);
        } catch (IOException e) {
            // Không throw — việc xóa ảnh cũ không nên block logic chính
            log.warn("Cloudinary delete failed for public_id={}: {}", publicId, e.getMessage());
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File ảnh không được để trống.");
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Kích thước ảnh vượt quá giới hạn 10 MB.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Định dạng ảnh không hợp lệ. Chỉ chấp nhận: JPG, PNG, WEBP, GIF.");
        }
    }
}
