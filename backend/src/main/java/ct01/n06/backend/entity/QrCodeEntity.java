package ct01.n06.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

import java.util.concurrent.TimeUnit;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@RedisHash("qrcode")
public class QrCodeEntity {

    @Id
    private String qrToken;

    private Long eventId;

    private String pinCode;

    private String bluetoothId;

    @TimeToLive(unit = TimeUnit.SECONDS)
    private Long timeToLive;
}