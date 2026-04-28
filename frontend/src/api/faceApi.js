import { apiRequest } from "../shared/api/http";

function appendImagePayload(formData, imageFieldName, image, extra = {}) {
  formData.append(imageFieldName, image);
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  return formData;
}

export function getStudentFaceStatus() {
  return apiRequest("/v1/student/face-profile/status");
}

export function enrollStudentFace({ image, confirmRealImage }) {
  const body = appendImagePayload(new FormData(), "image", image, { confirmRealImage });
  return apiRequest("/v1/student/face-profile/enroll", {
    method: "POST",
    body,
  });
}

export function createStudentFaceUpdateRequest({ image, reason, confirmRealImage }) {
  const body = appendImagePayload(new FormData(), "image", image, { reason, confirmRealImage });
  return apiRequest("/v1/student/face-profile/update-requests", {
    method: "POST",
    body,
  });
}

export function getStudentFaceUpdateRequests({ status, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return apiRequest(`/v1/student/face-profile/update-requests?${params.toString()}`);
}

export function getLecturerFaceUpdateRequests({ status, classId, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  if (classId) params.set("classId", String(classId));
  return apiRequest(`/v1/lecturer/face-update-requests?${params.toString()}`);
}

export function approveFaceUpdateRequest(requestId, reviewNote) {
  return apiRequest(`/v1/lecturer/face-update-requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

export function rejectFaceUpdateRequest(requestId, reviewNote) {
  return apiRequest(`/v1/lecturer/face-update-requests/${requestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

export function createFaceAttendanceSession(payload) {
  return apiRequest("/v1/lecturer/face-attendance/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recognizeFaceAttendanceFrame(sessionId, frame) {
  const body = appendImagePayload(new FormData(), "frame", frame);
  return apiRequest(`/v1/lecturer/face-attendance/sessions/${sessionId}/recognize`, {
    method: "POST",
    body,
  });
}

export function confirmFaceAttendance(sessionId, selectedStudentIds) {
  return apiRequest(`/v1/lecturer/face-attendance/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ selectedStudentIds }),
  });
}

export function closeFaceAttendanceSession(sessionId) {
  return apiRequest(`/v1/lecturer/face-attendance/sessions/${sessionId}/close`, {
    method: "POST",
  });
}
