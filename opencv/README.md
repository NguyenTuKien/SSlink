# DeepFace AI Service

Python service cho bai toan nhan dien khuon mat, duoc backend Spring Boot goi qua HTTP.

## Endpoints

- `GET /health`: kiem tra service song.
- `POST /detect` (`multipart/form-data`):
  - `file`: anh JPG/PNG.
  - optional: `model_name`, `detector_backend`, `enforce_detection`.
  - tra ve danh sach `face_id` tam thoi va chat luong anh.
- `POST /verify` (`multipart/form-data`):
  - `face_id_1`, `face_id_2`.
  - optional: `model_name`, `detector_backend`, `enforce_detection`.
  - tra ve `verified`, `distance`, `threshold`.
- `POST /match` (`application/json`):
  - `probe_face_ids`, `candidate_face_ids`, `top_k`.
  - doi sanh hang loat de tim ung vien gan nhat cho nhieu khuon mat trong cung mot lan goi.

## Local run

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Environment variables

- `AI_SERVICE_AUTH_TOKEN`: token noi bo, co the de trong.
- `AI_FACE_SERVICE_AUTH_TOKEN`: alias tuong thich voi backend (neu `AI_SERVICE_AUTH_TOKEN` chua set).
- `DEEPFACE_MODEL_NAME`: mac dinh `Facenet512`.
- `DEEPFACE_DETECTOR_BACKEND`: mac dinh `retinaface`.
- `DEEPFACE_ENFORCE_DETECTION`: mac dinh `true`.
- `DEEPFACE_DISTANCE_THRESHOLD`: mac dinh `0.4`.
- `DEEPFACE_FACE_ID_TTL_SECONDS`: mac dinh `900`.
- `DEEPFACE_MAX_UPLOAD_BYTES`: gioi han kich thuoc file upload (mac dinh `4194304` bytes).
- `DEEPFACE_MAX_IMAGE_EDGE`: resize canh dai nhat truoc khi infer de tang toc (mac dinh `1600`).
- `DEEPFACE_WARMUP_ENABLED`: bat/tat warm-up model khi startup (mac dinh `true`).
- `DEEPFACE_WARMUP_MODEL_NAME`: model warm-up khi startup (mac dinh bang `DEEPFACE_MODEL_NAME`).

## Docker

```bash
docker build -t deepface-ai-service ./ai-service
docker run -p 8000:8000 deepface-ai-service
```

Neu dung docker-compose cua repo, backend se tu dong goi service nay qua `http://ai-service:8000`.
