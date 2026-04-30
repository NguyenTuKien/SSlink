package ct01.n06.backend.constant;

public class QrCodeConstant {

  private QrCodeConstant() {
  }

  public static final String TABLE_NAME = "qr_codes";
  public static final String COL_ID = "id";
  public static final String COL_EVENT_ID = "event_id";
  public static final String COL_QR_TOKEN = "qr_token";
  public static final String COL_PIN_CODE = "pin_code";
  public static final String COL_EXPIRE_AT = "expire_at";

  public static final String REDIS_PIN_PREFIX = "qrcode:pin:";
  public static final String REDIS_TOTP_REPLAY_PREFIX = "qrcode:totp:used:";
  public static final String REDIS_DEVICE_LOCK_PREFIX = "qrcode:lock:device:event:";
}
