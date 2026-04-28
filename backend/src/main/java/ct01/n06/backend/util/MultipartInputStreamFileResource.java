package ct01.n06.backend.util;

import org.springframework.core.io.ByteArrayResource;

public class MultipartInputStreamFileResource extends ByteArrayResource {

  private final String filename;

  public MultipartInputStreamFileResource(byte[] byteArray, String filename) {
    super(byteArray);
    this.filename = filename;
  }

  @Override
  public String getFilename() {
    return filename;
  }
}
