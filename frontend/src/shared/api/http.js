import { AUTH_STORAGE_KEY } from "../../context/AuthContext";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

const DEFAULT_API_BASE_URL = "/api";
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE_URL;

function getTokenFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed?.accessToken) {
      return parsed.accessToken;
    }

    return null;
  } catch {
    // Invalid stored session: clear stale auth data to avoid sending wrong token.
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
    return null;
  }
}

function buildMessage(payload, status) {
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      if (payload.message.trim() === "SYSTEM_ERROR_GROUP") {
        return "Hệ thống đang gặp lỗi khi xử lý dữ liệu. Vui lòng thử lại sau.";
      }
      return payload.message;
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  }

  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (status === 403) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (status === 404) {
    return "Không tìm thấy dữ liệu yêu cầu.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Không kết nối được backend. Vui lòng kiểm tra server backend.";
  }
  return `Yêu cầu thất bại (HTTP ${status}). Vui lòng thử lại.`;
}

async function readPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return { message: raw };
    }
  }

  return { message: raw };
}

export async function apiRequest(path, options = {}) {
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getTokenFromStorage();

  const headers = {
    Accept: "application/json",
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response;
  try {
    const isFormData = options.body instanceof FormData;
    const fetchFn = (isTauri && !isFormData) ? tauriFetch : fetch;
    response = await fetchFn(url, {
      method: options.method || "GET",
      ...options,
      credentials: "include",
      headers,
    });
  } catch (err) {
    console.error("apiRequest Error:", err);
    throw new Error(
      "Không kết nối được backend. Kiểm tra backend đang chạy tại http://localhost:8080.",
    );
  }

  const payload = await readPayload(response);

  if (!response.ok) {
    const errorMessage = buildMessage(payload, response.status);

    // Xử lý lỗi 401: phiên hết hạn hoặc đăng nhập ở thiết bị khác
    if (response.status === 401) {
      // Hiển thị alert
      alert(errorMessage);

      // Xóa localStorage
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("refreshToken");

        // Redirect về /auth
        window.location.href = "/auth";
      }
    }

    throw new Error(errorMessage);
  }

  return payload;
}

export async function apiBinaryRequest(path, options = {}) {
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getTokenFromStorage();

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response;
  try {
    const isFormData = options.body instanceof FormData;
    const fetchFn = (isTauri && !isFormData) ? tauriFetch : fetch;
    response = await fetchFn(url, {
      method: options.method || "GET",
      ...options,
      credentials: "include",
      headers,
    });
  } catch (err) {
    console.error("apiBinaryRequest Error:", err);
    throw new Error(
      "Không kết nối được backend. Kiểm tra backend đang chạy tại http://localhost:8080.",
    );
  }

  if (!response.ok) {
    const payload = await readPayload(response);
    const errorMessage = buildMessage(payload, response.status);

    if (response.status === 401) {
      alert(errorMessage);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("refreshToken");
        window.location.href = "/auth";
      }
    }

    throw new Error(errorMessage);
  }

  return response;
}
