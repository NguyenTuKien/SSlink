import { apiBinaryRequest, apiRequest } from "../shared/api/http";

function extractFileName(contentDisposition, fallbackName) {
  if (!contentDisposition) {
    return fallbackName;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1];
  }

  return fallbackName;
}

export async function importAdminStudentsExcel(formData) {
  return apiRequest("/v1/admin/students/import", {
    method: "POST",
    body: formData,
  });
}

export async function getAdminStudentImportBatchStatus(batchId) {
  return apiRequest(`/v1/admin/students/import/${batchId}/status`);
}

export async function exportAdminStudentsExcel() {
  const response = await apiBinaryRequest("/v1/admin/students/export");
  const blob = await response.blob();
  const fileName = extractFileName(
    response.headers.get("content-disposition"),
    "admin-danh-sach-sinh-vien.xlsx",
  );
  return { blob, fileName };
}



export async function exportAdminLecturersExcel() {
  const response = await apiBinaryRequest("/v1/admin/lecturers/export");
  const blob = await response.blob();
  const fileName = extractFileName(
    response.headers.get("content-disposition"),
    "admin-danh-sach-giang-vien.xlsx",
  );
  return { blob, fileName };
}
