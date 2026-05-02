package ct01.n06.backend.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobStatus implements Serializable {
    private String batchId;
    private String status; // PENDING, PROCESSING, COMPLETED, PARTIAL_SUCCESS, FAILED
    private int importedCount;
    private int skippedCount;
    private String username;
    
    @Builder.Default
    private List<String> errors = new ArrayList<>();
}
