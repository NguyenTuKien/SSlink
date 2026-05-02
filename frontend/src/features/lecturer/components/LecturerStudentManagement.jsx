import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../../shared/api/http";
import { useAuth } from "../../../context/AuthContext";
import { useLecturerData } from "../hooks/useLecturerData";
import "../../../styles/LecturerStudentManagement.css";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "ACTIVE", label: "Hoạt động" },
  { value: "LOCKED", label: "Bị khóa" },
  { value: "DELETED", label: "Đã xóa" },
];

const STATUS_LABEL = {
  ACTIVE: "Hoạt động",
  LOCKED: "Bị khóa",
  DELETED: "Đã xóa",
};

const ROLE_LABEL = {
  MONITOR: "Monitor",
  STUDENT: "Student",
};

const DEFAULT_MANUAL_FORM = {
  classId: "",
  fullName: "",
  email: "",
  studentCode: "",
  password: "",
};

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function LecturerStudentManagement() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const lecturerId = user?.backendUserId ?? user?.userId ?? "";

  const [filters, setFilters] = useState({
    keyword: "",
    facultyId: "",
    classId: "",
    status: "",
  });

  const { options, rows, summary, loading, flash, setFlash, loadStudents } = useLecturerData(lecturerId, filters);

  const [currentPage, setCurrentPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState(DEFAULT_MANUAL_FORM);

  const classOptions = useMemo(() => {
    if (!filters.facultyId) {
      return options.classes;
    }
    return options.classes.filter(
      (item) => String(item.facultyId) === String(filters.facultyId),
    );
  }, [filters.facultyId, options.classes]);

  const filteredCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, rows]);

  // Sync default class option
  useEffect(() => {
    if (options.classes.length > 0 && !manualForm.classId) {
      setManualForm((prev) => ({
        ...prev,
        classId: prev.classId || String(options.classes[0].id),
      }));
    }
  }, [options.classes, manualForm.classId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!flash.message || flash.type === "error") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setFlash({ type: "", message: "" });
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [flash.message, flash.type, setFlash]);

  const runAction = async (runner, successMessage) => {
    setBusy(true);
    setFlash({ type: "", message: "" });

    try {
      await runner();
      setFlash({ type: "success", message: successMessage });
      await loadStudents();
    } catch (err) {
      setFlash({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImporting(true);
    setFlash({ type: "", message: "" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const enqueue = await apiRequest(`/lecturer/students/import?lecturerId=${lecturerId}`, {
        method: "POST",
        body: formData,
      }, false);

      const batchId = enqueue?.batchId;
      if (!batchId) {
        throw new Error("Không thể khởi tạo queue import.");
      }

      let attempts = 0;
      let batchStatus = null;
      let currentInterval = 300;

      while (attempts < 60) {
        batchStatus = await apiRequest(`/lecturer/students/import/${batchId}?lecturerId=${lecturerId}`);
        if (["COMPLETED", "PARTIAL_SUCCESS", "FAILED"].includes(batchStatus?.status)) {
          break;
        }
        attempts += 1;
        await sleep(currentInterval);
        if (currentInterval < 1500) {
          currentInterval = Math.min(currentInterval * 1.5, 1500);
        }
      }

      if (!["COMPLETED", "PARTIAL_SUCCESS", "FAILED"].includes(batchStatus?.status)) {
        throw new Error("Queue import đang xử lý, vui lòng kiểm tra lại sau.");
      }

      await loadStudents();

      const importedCount = Number(batchStatus.importedCount || 0);
      const skippedCount = Number(batchStatus.skippedCount || 0);
      const flattenedErrors = Array.isArray(batchStatus.errors) ? batchStatus.errors : [];

      setImportResult({
        importedCount,
        skippedCount,
        errors: flattenedErrors,
        total: importedCount + skippedCount,
      });

    } catch (err) {
      setFlash({ type: "error", message: err.message });
    } finally {
      event.target.value = "";
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    const tableHeader = `
      <tr>
        <th>MSSV</th>
        <th>Họ tên</th>
        <th>Email</th>
        <th>Lớp</th>
        <th>Vai trò</th>
        <th>Trạng thái</th>
        <th>Tổng điểm</th>
        <th>Sự kiện bắt buộc</th>
      </tr>
    `;

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${htmlEscape(row.studentCode)}</td>
            <td>${htmlEscape(row.fullName)}</td>
            <td>${htmlEscape(row.email)}</td>
            <td>${htmlEscape(row.classCode)}</td>
            <td>${htmlEscape(ROLE_LABEL[row.role] || row.role)}</td>
            <td>${htmlEscape(STATUS_LABEL[row.accountStatus] || row.accountStatus)}</td>
            <td>${htmlEscape(row.totalPoint ?? 0)}</td>
            <td>${htmlEscape(row.mandatoryStatus)}</td>
          </tr>
        `,
      )
      .join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <table border="1">
            ${tableHeader}
            ${tableRows}
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "danh-sach-sinh-vien.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();

    await runAction(
      () =>
        apiRequest(`/lecturer/students/manual?lecturerId=${lecturerId}`, {
          method: "POST",
          body: JSON.stringify({
            classId: Number(manualForm.classId),
            fullName: manualForm.fullName,
            email: manualForm.email,
            studentCode: manualForm.studentCode,
            password: manualForm.password,
          }),
        }),
      "Thêm sinh viên thành công.",
    );

    setShowManualModal(false);
    setManualForm((prev) => ({
      ...DEFAULT_MANUAL_FORM,
      classId: prev.classId,
    }));
  };

  if (loading) {
    return <div className="page-state">Đang tải dữ liệu quản lý sinh viên...</div>;
  }

  return (
    <section className="lecturer-main">
      <section className="lecturer-section">
        <div className="section-head">
          <div>
            <h1>Quản lý Sinh viên</h1>
            <p>
              Tổng số: <strong>{summary.totalStudents}</strong> sinh viên
            </p>
          </div>

          <div className="head-actions">
            <button type="button" className="btn-outline" onClick={handleExport}>
              Xuất Excel
            </button>
            {isImporting ? (
              <button type="button" className="btn-outline danger" disabled>
                <span className="spinner" style={{ marginRight: '8px' }}></span> Đang xử lý...
              </button>
            ) : (
              <button
                type="button"
                className="btn-outline danger"
                onClick={() => fileInputRef.current?.click()}
              >
                Import Excel
              </button>
            )}
            <button type="button" className="btn-danger" onClick={() => setShowManualModal(true)}>
              Thêm thủ công
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".xlsx,.xls"
          onChange={handleImport}
        />

        <div className="summary-pills">
          <span>Hoạt động: {summary.activeStudents}</span>
          <span>Bị khóa: {summary.lockedStudents}</span>
          <span>Monitor: {summary.monitorStudents}</span>
        </div>

        <div className="filter-row">
          <input
            type="search"
            placeholder="Tên, MSSV hoặc Email..."
            value={filters.keyword}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, keyword: event.target.value }))
            }
          />

          <select
            value={filters.facultyId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                facultyId: event.target.value,
                classId: "",
              }))
            }
          >
            <option value="">Tất cả Khoa</option>
            {options.faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}
          </select>

          <select
            value={filters.classId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, classId: event.target.value }))
            }
          >
            <option value="">Tất cả Lớp</option>
            {classOptions.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.classCode}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status.value || "all"} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {flash.message && <div className={`flash ${flash.type}`}>{flash.message}</div>}

        {/* ── MOBILE: Card layout (< 768px) ── */}
        <div className="student-cards">
          {pageRows.length === 0 ? (
            <div className="student-cards__empty">Không có sinh viên phù hợp bộ lọc.</div>
          ) : pageRows.map((row) => (
            <div key={row.studentId} className="student-card">
              {/* Name + badges */}
              <div className="student-card__header">
                <div className="student-card__info">
                  <strong>{row.fullName}</strong>
                  <small>{row.email}</small>
                </div>
                <div className="student-card__badges">
                  <span className={`pill role ${row.role.toLowerCase()}`}>
                    {ROLE_LABEL[row.role] || row.role}
                  </span>
                  <span className={`pill status ${row.accountStatus.toLowerCase()}`}>
                    {STATUS_LABEL[row.accountStatus] || row.accountStatus}
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="student-card__meta">
                <span>📋 {row.studentCode} · {row.classCode}</span>
                <span>⭐ {row.totalPoint ?? 0} điểm</span>
                <span>🎯 {row.mandatoryStatus}</span>
              </div>

              {/* Actions */}
              <div className="student-card__actions">
                <button
                  type="button"
                  disabled={busy}
                  title="Gán lớp trưởng"
                  onClick={() =>
                    runAction(
                      () => apiRequest(`/lecturer/students/${row.studentId}/monitor?lecturerId=${lecturerId}`, { method: "PUT" }),
                      `Đã gán ${row.fullName} làm lớp trưởng.`,
                    )
                  }
                >☆ Lớp trưởng</button>
                <button
                  type="button"
                  disabled={busy}
                  title={row.accountStatus === "LOCKED" ? "Mở khóa" : "Khóa"}
                  onClick={() =>
                    runAction(
                      () => apiRequest(`/lecturer/students/${row.studentId}/status?lecturerId=${lecturerId}`, {
                        method: "PUT",
                        body: JSON.stringify({ status: row.accountStatus === "LOCKED" ? "ACTIVE" : "LOCKED" }),
                      }),
                      row.accountStatus === "LOCKED" ? `Đã mở khóa ${row.fullName}.` : `Đã khóa ${row.fullName}.`,
                    )
                  }
                >{row.accountStatus === "LOCKED" ? "🔓 Mở khóa" : "🔒 Khóa"}</button>
                <button
                  type="button"
                  disabled={busy}
                  className="danger"
                  title="Xóa mềm"
                  onClick={() =>
                    runAction(
                      () => apiRequest(`/lecturer/students/${row.studentId}?lecturerId=${lecturerId}`, { method: "DELETE" }),
                      `Đã xóa mềm ${row.fullName}.`,
                    )
                  }
                >🗑 Xóa</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: Table layout (≥ 768px) ── */}
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>MSSV / Lớp</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Điểm</th>
                <th>Sự kiện bắt buộc</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>Không có sinh viên phù hợp bộ lọc.</td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.studentId}>
                    <td>
                      <strong>{row.fullName}</strong>
                      <small>{row.email}</small>
                    </td>
                    <td>
                      <strong>{row.studentCode}</strong>
                      <small>{row.classCode}</small>
                    </td>
                    <td>
                      <span className={`pill role ${row.role.toLowerCase()}`}>
                        {ROLE_LABEL[row.role] || row.role}
                      </span>
                    </td>
                    <td>
                      <span className={`pill status ${row.accountStatus.toLowerCase()}`}>
                        {STATUS_LABEL[row.accountStatus] || row.accountStatus}
                      </span>
                    </td>
                    <td>{row.totalPoint ?? 0}</td>
                    <td>{row.mandatoryStatus}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          disabled={busy}
                          title="Gán lớp trưởng"
                          onClick={() =>
                            runAction(
                              () => apiRequest(`/lecturer/students/${row.studentId}/monitor?lecturerId=${lecturerId}`, { method: "PUT" }),
                              `Đã gán ${row.fullName} làm lớp trưởng.`,
                            )
                          }
                        >☆</button>
                        <button
                          type="button"
                          disabled={busy}
                          title={row.accountStatus === "LOCKED" ? "Mở khóa" : "Khóa"}
                          onClick={() =>
                            runAction(
                              () => apiRequest(`/lecturer/students/${row.studentId}/status?lecturerId=${lecturerId}`, {
                                method: "PUT",
                                body: JSON.stringify({ status: row.accountStatus === "LOCKED" ? "ACTIVE" : "LOCKED" }),
                              }),
                              row.accountStatus === "LOCKED" ? `Đã mở khóa ${row.fullName}.` : `Đã khóa ${row.fullName}.`,
                            )
                          }
                        >{row.accountStatus === "LOCKED" ? "🔓" : "🔒"}</button>
                        <button
                          type="button"
                          disabled={busy}
                          className="danger"
                          title="Xóa mềm"
                          onClick={() =>
                            runAction(
                              () => apiRequest(`/lecturer/students/${row.studentId}?lecturerId=${lecturerId}`, { method: "DELETE" }),
                              `Đã xóa mềm ${row.fullName}.`,
                            )
                          }
                        >🗑</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>


        </div>

        {/* Mobile pagination */}
        <footer className="table-footer mobile-pagination">
          <span>
            Trang {currentPage} / {totalPages} · {filteredCount} sinh viên
          </span>
          <div className="pagination">
            <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>‹</button>
            <span>{currentPage}</span>
            <button type="button" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>›</button>
          </div>
        </footer>
      </section>

      {showManualModal && (
        <div className="modal-mask">
          <form className="modal-panel" onSubmit={handleManualSubmit}>
            <h3>Thêm sinh viên thủ công</h3>

            <label>
              Họ và tên
              <input
                value={manualForm.fullName}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                maxLength={100}
                required
              />
            </label>

            <label>
              Mã sinh viên
              <input
                value={manualForm.studentCode}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, studentCode: event.target.value }))
                }
                maxLength={20}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={manualForm.email}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, email: event.target.value }))
                }
                maxLength={100}
                required
              />
            </label>

            <label>
              Lớp
              <select
                value={manualForm.classId}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, classId: event.target.value }))
                }
                required
              >
                <option value="">Chọn lớp</option>
                {options.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classCode}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Mật khẩu
              <input
                type="text"
                placeholder="Để trống sẽ dùng UniPoint@123"
                value={manualForm.password}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, password: event.target.value }))
                }
                maxLength={255}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={() => setShowManualModal(false)}>
                Hủy
              </button>
              <button type="submit" className="btn-danger" disabled={busy}>
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

      {importResult && (
        <div className="modal-mask">
          <div className="modal-panel" style={{ maxWidth: "600px", width: "90%" }}>
            <h3>Kết quả Import Excel</h3>
            <div className="import-summary" style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
              <p>Đã xử lý: <strong>{importResult.total}</strong> dòng dữ liệu.</p>
              <p style={{ color: "green" }}>Thành công: <strong>{importResult.importedCount}</strong>.</p>
              <p style={{ color: "red" }}>Lỗi / Bỏ qua: <strong>{importResult.skippedCount}</strong>.</p>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="import-errors" style={{ maxHeight: "300px", overflowY: "auto", background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "4px", fontSize: "14px", border: "1px solid #f5c6cb" }}>
                <strong>Chi tiết lỗi:</strong>
                <ul style={{ paddingLeft: "20px", marginTop: "10px", marginBottom: "0" }}>
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-danger"
                onClick={() => setImportResult(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
