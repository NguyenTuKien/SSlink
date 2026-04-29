import logging
import os
import time
import uuid
from threading import Lock
from typing import Any

import cv2
import numpy as np
from deepface import DeepFace
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

app = FastAPI(
    title="Face Recognition AI Service",
    description="AI service for face verification using DeepFace",
    version="1.1.0",
)

logger = logging.getLogger("deepface-ai-service")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, str(default)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


AI_TOKEN = os.getenv("AI_SERVICE_AUTH_TOKEN") or os.getenv("AI_FACE_SERVICE_AUTH_TOKEN", "")
DEFAULT_MODEL_NAME = os.getenv("DEEPFACE_MODEL_NAME", "Facenet512")
DEFAULT_DETECTOR_BACKEND = os.getenv("DEEPFACE_DETECTOR_BACKEND", "retinaface")
DEFAULT_ENFORCE_DETECTION = _env_bool("DEEPFACE_ENFORCE_DETECTION", True)
DEFAULT_THRESHOLD = float(os.getenv("DEEPFACE_DISTANCE_THRESHOLD", "0.4"))
CACHE_TTL_SECONDS = int(os.getenv("DEEPFACE_FACE_ID_TTL_SECONDS", "900"))
MAX_UPLOAD_BYTES = int(os.getenv("DEEPFACE_MAX_UPLOAD_BYTES", "4194304"))
MAX_IMAGE_EDGE = max(0, int(os.getenv("DEEPFACE_MAX_IMAGE_EDGE", "1600")))
WARMUP_ENABLED = _env_bool("DEEPFACE_WARMUP_ENABLED", True)
WARMUP_MODEL_NAME = os.getenv("DEEPFACE_WARMUP_MODEL_NAME", DEFAULT_MODEL_NAME)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}
_cache_lock = Lock()
_model_lock = Lock()
_embedding_cache: dict[str, tuple[np.ndarray, float]] = {}
_loaded_models: set[str] = set()


class MatchRequest(BaseModel):
    probe_face_ids: list[str] = Field(default_factory=list)
    candidate_face_ids: list[str] = Field(default_factory=list)
    top_k: int = 1


def _assert_token(token: str | None) -> None:
    if AI_TOKEN and token != AI_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid AI service token")


def _cleanup_expired_cache() -> None:
    now = time.time()
    with _cache_lock:
        expired = [key for key, (_, ts) in _embedding_cache.items() if now - ts > CACHE_TTL_SECONDS]
        for key in expired:
            _embedding_cache.pop(key, None)


def _normalize(vec: list[float] | np.ndarray) -> np.ndarray:
    np_vec = np.asarray(vec, dtype=np.float32)
    norm = np.linalg.norm(np_vec)
    if norm == 0.0:
        return np_vec
    return np_vec / norm


def _to_quality_label(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"


def _distance_to_confidence(distance: float) -> float:
    if DEFAULT_THRESHOLD <= 0.0:
        return 0.0
    confidence = 1.0 - (distance / DEFAULT_THRESHOLD)
    return max(0.0, min(1.0, confidence))


def _clamp_int(value: float | int | None, low: int, high: int) -> int:
    if value is None:
        return low
    return int(max(low, min(high, int(round(float(value))))))


def _extract_face_box(rep: dict[str, Any], image_width: int, image_height: int) -> dict[str, float | int] | None:
    facial_area = rep.get("facial_area") or rep.get("region") or rep.get("face_region")
    if facial_area is None:
        return None

    x = y = w = h = None
    if isinstance(facial_area, dict):
        x = facial_area.get("x", facial_area.get("left", facial_area.get("x1")))
        y = facial_area.get("y", facial_area.get("top", facial_area.get("y1")))
        w = facial_area.get("w", facial_area.get("width"))
        h = facial_area.get("h", facial_area.get("height"))
        if (w is None or h is None) and all(key in facial_area for key in ("left", "top", "right", "bottom")):
            x = facial_area.get("left")
            y = facial_area.get("top")
            w = float(facial_area.get("right", 0)) - float(facial_area.get("left", 0))
            h = float(facial_area.get("bottom", 0)) - float(facial_area.get("top", 0))
        if (w is None or h is None) and all(key in facial_area for key in ("x1", "y1", "x2", "y2")):
            x = facial_area.get("x1")
            y = facial_area.get("y1")
            w = float(facial_area.get("x2", 0)) - float(facial_area.get("x1", 0))
            h = float(facial_area.get("y2", 0)) - float(facial_area.get("y1", 0))
    elif isinstance(facial_area, (list, tuple)) and len(facial_area) >= 4:
        x1, y1, x2, y2 = facial_area[0], facial_area[1], facial_area[2], facial_area[3]
        x = x1
        y = y1
        w = float(x2) - float(x1)
        h = float(y2) - float(y1)

    if x is None or y is None or w is None or h is None:
        return None

    safe_x = _clamp_int(x, 0, max(0, image_width - 1))
    safe_y = _clamp_int(y, 0, max(0, image_height - 1))
    safe_w = _clamp_int(w, 1, max(1, image_width - safe_x))
    safe_h = _clamp_int(h, 1, max(1, image_height - safe_y))

    return {
        "x": safe_x,
        "y": safe_y,
        "width": safe_w,
        "height": safe_h,
        "x_ratio": round(safe_x / float(image_width), 6) if image_width > 0 else 0.0,
        "y_ratio": round(safe_y / float(image_height), 6) if image_height > 0 else 0.0,
        "width_ratio": round(safe_w / float(image_width), 6) if image_width > 0 else 0.0,
        "height_ratio": round(safe_h / float(image_height), 6) if image_height > 0 else 0.0,
    }


def _extract_face_regions(
    image: np.ndarray,
    detector_backend: str,
    enforce_detection: bool,
    image_width: int,
    image_height: int,
) -> list[dict[str, float | int] | None]:
    try:
        extracted = DeepFace.extract_faces(
            img_path=image,
            detector_backend=detector_backend,
            enforce_detection=enforce_detection,
            align=True,
        )
    except TypeError:
        extracted = DeepFace.extract_faces(
            img_path=image,
            detector_backend=detector_backend,
            enforce_detection=enforce_detection,
        )
    except Exception:
        return []

    if not isinstance(extracted, list):
        return []

    boxes: list[dict[str, float | int] | None] = []
    for face in extracted:
        if not isinstance(face, dict):
            continue
        boxes.append(_extract_face_box(face, image_width, image_height))
    return boxes


def _ensure_model_loaded(model_name: str) -> None:
    if not model_name:
        return
    with _model_lock:
        if model_name in _loaded_models:
            return
        try:
            DeepFace.build_model(task="facial_recognition", model_name=model_name)
        except TypeError:
            try:
                DeepFace.build_model(model_name=model_name)
            except TypeError:
                DeepFace.build_model(model_name)
        _loaded_models.add(model_name)
        logger.info("DeepFace model warmed up: %s", model_name)


def _decode_image(image_bytes: bytes) -> np.ndarray:
    matrix = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(matrix, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="invalid image payload")
    return image


def _resize_for_inference(image: np.ndarray) -> np.ndarray:
    if MAX_IMAGE_EDGE <= 0:
        return image
    height, width = image.shape[:2]
    largest_edge = max(height, width)
    if largest_edge <= MAX_IMAGE_EDGE:
        return image
    scale = MAX_IMAGE_EDGE / float(largest_edge)
    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)


def _represent_faces(
    image: np.ndarray,
    model_name: str,
    detector_backend: str,
    enforce_detection: bool,
) -> list[dict[str, Any]]:
    _ensure_model_loaded(model_name)
    representations = DeepFace.represent(
        img_path=image,
        model_name=model_name,
        detector_backend=detector_backend,
        enforce_detection=enforce_detection,
    )
    if isinstance(representations, dict):
        return [representations]
    if isinstance(representations, list):
        return representations
    raise HTTPException(status_code=500, detail="Invalid DeepFace response format")


@app.on_event("startup")
def warmup_default_model() -> None:
    if not WARMUP_ENABLED:
        return
    try:
        _ensure_model_loaded(WARMUP_MODEL_NAME)
    except Exception as exc:  # pragma: no cover
        logger.warning("DeepFace warmup skipped due to error: %s", exc)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "deepface-ai-service"}


@app.post("/detect")
async def detect_face(
    file: UploadFile = File(...),
    model_name: str = Form(DEFAULT_MODEL_NAME),
    detector_backend: str = Form(DEFAULT_DETECTOR_BACKEND),
    enforce_detection: bool = Form(DEFAULT_ENFORCE_DETECTION),
    x_ai_service_token: str | None = Header(default=None),
):
    _assert_token(x_ai_service_token)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="file must be JPG or PNG image")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty image payload")
    if MAX_UPLOAD_BYTES > 0 and len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"file too large, max is {MAX_UPLOAD_BYTES} bytes")

    try:
        image = _resize_for_inference(_decode_image(image_bytes))
        image_height, image_width = image.shape[:2]
        representations = await run_in_threadpool(
            _represent_faces,
            image,
            model_name,
            detector_backend,
            enforce_detection,
        )

        fallback_face_boxes: list[dict[str, float | int] | None] = []
        if any(_extract_face_box(rep, image_width, image_height) is None for rep in representations):
            fallback_face_boxes = await run_in_threadpool(
                _extract_face_regions,
                image,
                detector_backend,
                enforce_detection,
                image_width,
                image_height,
            )

        _cleanup_expired_cache()
        faces: list[dict[str, Any]] = []
        with _cache_lock:
            for index, rep in enumerate(representations):
                embedding = rep.get("embedding")
                if not embedding:
                    continue
                face_id = str(uuid.uuid4())
                _embedding_cache[face_id] = (_normalize(embedding), time.time())

                quality_score = float(rep.get("face_confidence", 0.9))
                quality_score = max(0.0, min(1.0, quality_score))
                face_box = _extract_face_box(rep, image_width, image_height)
                if face_box is None and index < len(fallback_face_boxes):
                    face_box = fallback_face_boxes[index]
                faces.append(
                    {
                        "face_id": face_id,
                        "quality_score": quality_score,
                        "quality_label": _to_quality_label(quality_score),
                        "face_box": face_box,
                    }
                )

        faces.sort(key=lambda item: item["quality_score"], reverse=True)
        return {
            "success": True,
            "faces": faces,
            "model": model_name,
            "detector_backend": detector_backend,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Face detection failed: {str(exc)}") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal AI service error: {str(exc)}") from exc


@app.post("/verify")
def verify_face(
    face_id_1: str = Form(...),
    face_id_2: str = Form(...),
    model_name: str = Form(DEFAULT_MODEL_NAME),
    detector_backend: str = Form(DEFAULT_DETECTOR_BACKEND),
    enforce_detection: bool = Form(DEFAULT_ENFORCE_DETECTION),
    x_ai_service_token: str | None = Header(default=None),
):
    _assert_token(x_ai_service_token)
    _cleanup_expired_cache()

    with _cache_lock:
        left = _embedding_cache.get(face_id_1)
        right = _embedding_cache.get(face_id_2)

    if left is None or right is None:
        raise HTTPException(status_code=404, detail="face_id not found or expired")

    distance = float(1.0 - np.dot(left[0], right[0]))
    verified = distance <= DEFAULT_THRESHOLD

    return {
        "success": True,
        "verified": verified,
        "distance": distance,
        "threshold": DEFAULT_THRESHOLD,
        "model": model_name,
        "detector_backend": detector_backend,
        "similarity_metric": "cosine",
        "enforce_detection": enforce_detection,
    }


@app.post("/match")
def match_faces(
    request: MatchRequest,
    x_ai_service_token: str | None = Header(default=None),
):
    _assert_token(x_ai_service_token)
    _cleanup_expired_cache()

    probe_face_ids = [face_id for face_id in request.probe_face_ids if face_id]
    candidate_face_ids = [face_id for face_id in request.candidate_face_ids if face_id]

    if not probe_face_ids or not candidate_face_ids:
        return {
            "success": True,
            "results": [],
            "threshold": DEFAULT_THRESHOLD,
            "similarity_metric": "cosine",
        }

    with _cache_lock:
        probe_items = [(face_id, _embedding_cache.get(face_id)) for face_id in probe_face_ids]
        candidate_items = [(face_id, _embedding_cache.get(face_id)) for face_id in candidate_face_ids]

    missing_face_ids = [
        face_id
        for face_id, cached in [*probe_items, *candidate_items]
        if cached is None
    ]
    if missing_face_ids:
        raise HTTPException(
            status_code=404,
            detail=f"face_id not found or expired: {', '.join(missing_face_ids[:10])}",
        )

    probe_matrix = np.stack([cached[0] for _, cached in probe_items if cached is not None])
    candidate_matrix = np.stack([cached[0] for _, cached in candidate_items if cached is not None])

    similarities = np.clip(np.matmul(probe_matrix, candidate_matrix.T), -1.0, 1.0)
    distances = 1.0 - similarities
    top_k = max(1, min(int(request.top_k or 1), len(candidate_face_ids)))

    results: list[dict[str, Any]] = []
    for probe_index, probe_face_id in enumerate(probe_face_ids):
        candidate_order = np.argsort(distances[probe_index])[:top_k]
        matches = []
        for candidate_index in candidate_order:
            distance = float(distances[probe_index, candidate_index])
            confidence = _distance_to_confidence(distance)
            matches.append(
                {
                    "face_id": candidate_face_ids[candidate_index],
                    "distance": distance,
                    "confidence": confidence,
                    "verified": distance <= DEFAULT_THRESHOLD,
                }
            )
        matches.sort(key=lambda item: item["confidence"], reverse=True)
        results.append({"probe_face_id": probe_face_id, "matches": matches})

    return {
        "success": True,
        "results": results,
        "threshold": DEFAULT_THRESHOLD,
        "similarity_metric": "cosine",
    }
