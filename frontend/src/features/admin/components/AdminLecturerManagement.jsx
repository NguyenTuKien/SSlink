import { useEffect, useMemo, useRef, useState } from "react";
import { createAdminClass } from "../../../api/adminClassApi";

const PAGE_SIZE = 20;

const STATUS_LABELS = {
  ACTIVE: "Hoạt động",
  LOCKED: "Bị khóa",
  DELETED: "Đã xóa",
};

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  LOCKED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  DELETED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

function StatChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm uppercase tracking-[0.18em] font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function normalizeClassId(value) {
  return String(value ?? "");
}

export default function AdminLecturerManagement({ workspace, onNavigate }) {
  const {
    options,
    lecturers,
    stats,
    filters,
    setFilters,
    loading,
    busy,
    flash,
    selectedLecturerId,
    selectedLecturer,
    setSelectedLecturerId,
    selectLecturer,
    updateLecturer,
    deleteLecturer,
    importLecturers,
    exportLecturers,
    refresh,
  } = workspace;
  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [localError, setLocalError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredCount = lecturers.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  const pageRows = useMemo(() => {
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      return lecturers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, lecturers]);

  useEffect(() => {
      setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
      if (currentPage > totalPages) {
          setCurrentPage(totalPages);
      }
  }, [currentPage, totalPages]);
  const [pendingClasses, setPendingClasses] = useState([]);
  const [newClassCode, setNewClassCode] = useState("");
  const [newClassFacultyId, setNewClassFacultyId] = useState("");
  const [editForm, setEditForm] = useState({
    fullName: "",
    lecturerCode: "",
    email: "",
    username: "",
    password: "",
    facultyId: "",
    status: "ACTIVE",
    classIds: [],
  });

  useEffect(() => {
    if (!selectedLecturer) {
      setIsEditing(false);
      return;
    }

    setEditForm({
      fullName: selectedLecturer.fullName || "",
      lecturerCode: selectedLecturer.lecturerCode || "",
      email: selectedLecturer.email || "",
      username: selectedLecturer.username || "",
      password: "",
      facultyId: selectedLecturer.facultyId ? String(selectedLecturer.facultyId) : "",
      status: selectedLecturer.status || "ACTIVE",
      classIds: Array.isArray(selectedLecturer.classIds)
        ? selectedLecturer.classIds.map((classId) => normalizeClassId(classId))
        : [],
    });

    setPendingClasses([]);
    setNewClassCode("");
    setNewClassFacultyId(selectedLecturer.facultyId ? String(selectedLecturer.facultyId) : "");
    setLocalError("");
  }, [selectedLecturer]);

  const selectedFacultyId = editForm.facultyId || String(selectedLecturer?.facultyId || "");
  const classesByFaculty = useMemo(() => {
    const classItems = Array.isArray(options.classes) ? options.classes : [];
    if (!selectedFacultyId) {
      return classItems;
    }
    return classItems.filter(
      (classItem) => String(classItem.facultyId || "") === String(selectedFacultyId),
    );
  }, [options.classes, selectedFacultyId]);

  const hasPendingChanges = useMemo(() => {
    if (!selectedLecturer) {
      return false;
    }

    const originalClassIds = (selectedLecturer.classIds || []).map(normalizeClassId).sort().join(",");
    const nextClassIds = [...editForm.classIds].map(normalizeClassId).sort().join(",");

    return (
      editForm.fullName.trim() !== (selectedLecturer.fullName || "") ||
      editForm.lecturerCode.trim() !== (selectedLecturer.lecturerCode || "") ||
      editForm.email.trim() !== (selectedLecturer.email || "") ||
      editForm.username.trim() !== (selectedLecturer.username || "") ||
      String(editForm.facultyId || "") !== String(selectedLecturer.facultyId || "") ||
      editForm.status !== (selectedLecturer.status || "ACTIVE") ||
      Boolean(editForm.password.trim()) ||
      originalClassIds !== nextClassIds ||
      pendingClasses.length > 0
    );
  }, [editForm, pendingClasses.length, selectedLecturer]);

  const pendingClassCodes = pendingClasses.map((item) => item.classCode);

  const handleToggleClass = (classId) => {
    const normalizedClassId = normalizeClassId(classId);
    setEditForm((previous) => ({
      ...previous,
      classIds: previous.classIds.includes(normalizedClassId)
        ? previous.classIds.filter((item) => item !== normalizedClassId)
        : [...previous.classIds, normalizedClassId],
    }));
  };

  const handleAddPendingClass = () => {
    const classCode = newClassCode.trim().toUpperCase();
    const facultyId = newClassFacultyId || selectedFacultyId;

    if (!classCode || !facultyId) {
      setLocalError("Nhập mã lớp và chọn khoa trước khi tạo lớp mới.");
      return;
    }

    const existsInSelected = classesByFaculty.some(
      (item) => String(item.classCode || "").toUpperCase() === classCode,
    );
    const existsInPending = pendingClassCodes.includes(classCode);
    if (existsInSelected || existsInPending) {
      setLocalError(`Lớp ${classCode} đã tồn tại trong danh sách chọn.`);
      return;
    }

    setLocalError("");
    setPendingClasses((previous) => [
      ...previous,
      {
        tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        classCode,
        facultyId: String(facultyId),
      },
    ]);
    setNewClassCode("");
    setNewClassFacultyId(String(facultyId));
  };

  const handleRemovePendingClass = (tempId) => {
    setPendingClasses((previous) => previous.filter((item) => item.tempId !== tempId));
  };

  const handleUpdateLecturer = async () => {
    if (!selectedLecturer) {
      return;
    }

    if (!hasPendingChanges) {
      setIsEditing(false);
      return;
    }

    if (!editForm.facultyId) {
      setLocalError("Vui lòng chọn khoa trước khi lưu.");
      return;
    }

    setLocalError("");
    try {
      await updateLecturer(selectedLecturer.lecturerId, {
        fullName: editForm.fullName,
        lecturerCode: editForm.lecturerCode,
        email: editForm.email,
        username: editForm.username,
        password: editForm.password,
        facultyId: Number(editForm.facultyId),
        classIds: editForm.classIds.map((classId) => Number(classId)),
        status: editForm.status,
      });

      if (pendingClasses.length > 0) {
        await Promise.all(
          pendingClasses.map((classItem) =>
            createAdminClass({
              classCode: classItem.classCode,
              facultyId: Number(classItem.facultyId),
              lecturerId: selectedLecturer.lecturerId,
            }),
          ),
        );
        await refresh();
      }

      setIsEditing(false);
      setPendingClasses([]);
      setNewClassCode("");
      setNewClassFacultyId("");
      setEditForm((previous) => ({ ...previous, password: "" }));
    } catch (error) {
      setLocalError(error.message || "Không thể cập nhật giảng viên.");
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedLecturer || selectedLecturer.status === "DELETED") {
      return;
    }

    const nextStatus = selectedLecturer.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    setLocalError("");
    try {
      await updateLecturer(selectedLecturer.lecturerId, {
        fullName: selectedLecturer.fullName,
        lecturerCode: selectedLecturer.lecturerCode,
        email: selectedLecturer.email,
        username: selectedLecturer.username,
        password: "",
        facultyId: selectedLecturer.facultyId,
        classIds: selectedLecturer.classIds || [],
        status: nextStatus,
      });
    } catch (error) {
      setLocalError(error.message || "Không thể thay đổi trạng thái giảng viên.");
    }
  };

  const handleDeleteLecturer = async () => {
    if (!selectedLecturer) {
      return;
    }
    const confirmed = window.confirm(
      `Xóa giảng viên ${selectedLecturer.fullName}?\nHệ thống sẽ chuyển trạng thái sang Đã xóa (không xóa cứng dữ liệu).`,
    );
    if (!confirmed) {
      return;
    }

    setLocalError("");
    try {
      await deleteLecturer(selectedLecturer.lecturerId);
    } catch (error) {
      setLocalError(error.message || "Không thể xóa giảng viên.");
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const files = event.target.files;
    if (!files?.length) {
        return;
    }
    setIsImporting(true);
    try {
        const result = await importLecturers(files);
        if (result) {
            setImportResult(result);
            setShowErrors(false);
        }
    } finally {
        setIsImporting(false);
        event.target.value = "";
    }
  };

  const handleExport = async () => {
    const { blob, fileName } = await exportLecturers();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
        Đang tải dữ liệu giảng viên...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls"
        className="hidden"
      />
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Danh sách giảng viên</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isImporting ? (
                <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-primary shadow-sm">
                    <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    Đang xử lý...
                </div>
            ) : null}
            <button
                type="button"
                onClick={handleExport}
                disabled={busy || isImporting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="material-symbols-outlined text-base">download</span>
                Xuất Excel
            </button>
            <button
                type="button"
                onClick={handleImportClick}
                disabled={busy || isImporting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="material-symbols-outlined text-base">upload</span>
                Import Excel
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("createLecturer")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Thêm giảng viên
            </button>
          </div>
        </div>

        {flash.message ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              flash.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10 dark:text-rose-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-200"
            }`}
          >
            {flash.message}
          </div>
        ) : null}

        {localError ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10 dark:text-rose-200">
            {localError}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatChip label="Tổng" value={stats.totalLecturers ?? 0} />
          <StatChip label="Hoạt động" value={stats.activeLecturers ?? 0} />
          <StatChip label="Bị khóa" value={stats.lockedLecturers ?? 0} />
          <StatChip label="Đã xóa" value={stats.deletedLecturers ?? 0} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <input
            type="search"
            value={filters.keyword}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, keyword: event.target.value }))
            }
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
            placeholder="Tìm theo tên, mã, email, khoa..."
          />
          <select
            value={filters.facultyId}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, facultyId: event.target.value }))
            }
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
          >
            <option value="">Tất cả khoa</option>
            {options.faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, status: event.target.value }))
            }
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="LOCKED">Bị khóa</option>
            <option value="DELETED">Đã xóa</option>
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Bảng giảng viên</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Giảng viên</th>
                  <th className="px-6 py-4">Khoa</th>
                  <th className="px-6 py-4">Lớp phụ trách</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Tạo lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.length > 0 ? (
                  pageRows.map((lecturer) => {
                    const isSelected = lecturer.lecturerId === selectedLecturerId;
                    return (
                      <tr
                        key={lecturer.lecturerId}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5" : "hover:bg-slate-50"
                        }`}
                        onClick={() => (selectLecturer || setSelectedLecturerId)?.(lecturer.lecturerId)}
                      >
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{lecturer.fullName}</p>
                            <p className="text-xs text-slate-500">
                              {lecturer.lecturerCode} · {lecturer.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{lecturer.facultyName || "--"}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          <div className="space-y-1">
                            <p>{lecturer.classCount ?? 0} lớp</p>
                            <p className="text-xs text-slate-500">
                              {(lecturer.classCodes || []).slice(0, 2).join(", ") || "Chưa gán lớp"}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                              STATUS_STYLES[lecturer.status] || "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {STATUS_LABELS[lecturer.status] || lecturer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-500">{lecturer.createdAt || "--"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      Không có giảng viên nào phù hợp bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <span className="text-sm text-slate-500">
                Hiển thị {(currentPage - 1) * PAGE_SIZE + (pageRows.length ? 1 : 0)} - {(currentPage - 1) * PAGE_SIZE + pageRows.length} trong tổng số {filteredCount} giảng viên
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-slate-700">{currentPage}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ›
                </button>
              </div>
            </footer>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Chi tiết giảng viên</h2>
              <p className="text-sm text-slate-500">Xem nhanh bản ghi đang chọn.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              {lecturers.length} bản ghi
            </span>
          </div>

          {selectedLecturer ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {selectedLecturer.lecturerCode}
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                  {selectedLecturer.fullName}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{selectedLecturer.email}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatChip label="Khoa" value={selectedLecturer.facultyName || "--"} />
                <StatChip label="Tài khoản" value={selectedLecturer.username || "--"} />
                <StatChip label="Lớp phụ trách" value={selectedLecturer.classCount ?? 0} />
                <StatChip
                  label="Trạng thái"
                  value={STATUS_LABELS[selectedLecturer.status] || selectedLecturer.status}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Các lớp đang phụ trách
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedLecturer.classCodes || []).length > 0 ? (
                    selectedLecturer.classCodes.map((classCode) => (
                      <span
                        key={classCode}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {classCode}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Chưa phụ trách lớp nào.</span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Thao tác</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    Sửa thông tin
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={busy || selectedLecturer.status === "DELETED"}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selectedLecturer.status === "LOCKED" ? "Mở khóa" : "Khóa tài khoản"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteLecturer}
                    disabled={busy || selectedLecturer.status === "DELETED"}
                    className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Xóa giảng viên
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Chưa chọn giảng viên nào.
            </div>
          )}
        </article>
      </section>

      {isEditing && selectedLecturer ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/30 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Chỉnh sửa giảng viên</h3>
                <p className="text-sm text-slate-500">Cập nhật thông tin cho {selectedLecturer.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
              >
                Đóng
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={editForm.fullName}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, fullName: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                placeholder="Họ và tên"
              />
              <input
                value={editForm.lecturerCode}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, lecturerCode: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                placeholder="Mã giảng viên"
              />
              <input
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, email: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                placeholder="Email"
              />
              <input
                value={editForm.username}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, username: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                placeholder="Username"
              />
              <select
                value={editForm.facultyId}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, facultyId: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Chọn khoa</option>
                {options.faculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, status: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
              >
                <option value="ACTIVE">Hoạt động</option>
                <option value="LOCKED">Bị khóa</option>
                <option value="DELETED">Đã xóa</option>
              </select>
              <input
                type="password"
                value={editForm.password}
                onChange={(event) =>
                  setEditForm((previous) => ({ ...previous, password: event.target.value }))
                }
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary sm:col-span-2"
                placeholder="Mật khẩu mới (để trống nếu không đổi)"
              />
            </div>

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lớp phụ trách</p>

              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Lớp hiện có</p>
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                    {classesByFaculty.length > 0 ? (
                      classesByFaculty.map((classItem) => {
                        const normalizedClassId = normalizeClassId(classItem.id);
                        const checked = editForm.classIds.includes(normalizedClassId);
                        return (
                          <label
                            key={classItem.id}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{classItem.classCode}</p>
                              <p className="text-xs text-slate-500">{classItem.facultyName || "Chưa gán khoa"}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleClass(classItem.id)}
                              className="h-4 w-4 accent-primary"
                            />
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">Không có lớp phù hợp với khoa đang chọn.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Tạo lớp mới</p>
                  <div className="mt-3 grid gap-3">
                    <input
                      value={newClassCode}
                      onChange={(event) => setNewClassCode(event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                      placeholder="Mã lớp mới"
                    />
                    <select
                      value={newClassFacultyId || selectedFacultyId}
                      onChange={(event) => setNewClassFacultyId(event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Chọn khoa</option>
                      {options.faculties.map((faculty) => (
                        <option key={faculty.id} value={faculty.id}>
                          {faculty.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddPendingClass}
                      className="rounded-xl border border-dashed border-primary px-4 py-2.5 text-sm font-bold text-primary"
                    >
                      Thêm lớp vào danh sách
                    </button>
                  </div>

                  {pendingClasses.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {pendingClasses.map((item) => (
                        <div
                          key={item.tempId}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{item.classCode}</p>
                            <p className="text-xs text-slate-500">
                              Sẽ tạo ở khoa:{" "}
                              {options.faculties.find(
                                (faculty) => String(faculty.id) === String(item.facultyId),
                              )?.name || item.facultyId}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingClass(item.tempId)}
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600"
                          >
                            Gỡ
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleUpdateLecturer}
                disabled={busy || !hasPendingChanges}
                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importResult ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
                  <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900">Kết quả Import</h3>
                      <button
                          type="button"
                          onClick={() => setImportResult(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                      >
                          <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                  </div>

                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Thành công</p>
                              <p className="mt-1 text-2xl font-black text-emerald-700">{importResult.importedCount || 0}</p>
                          </div>
                          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center">
                              <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Bị lỗi / Bỏ qua</p>
                              <p className="mt-1 text-2xl font-black text-rose-700">{importResult.skippedCount || 0}</p>
                          </div>
                      </div>

                      {importResult.errors?.length > 0 && (
                          <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                              <p className="mb-2 font-bold text-slate-900">Chi tiết lỗi:</p>
                              {importResult.errors.map((err, idx) => (
                                  <p key={idx} className="border-b border-rose-100 pb-1 last:border-0 last:pb-0">• {err}</p>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="mt-6 flex justify-end">
                      <button
                          type="button"
                          onClick={() => setImportResult(null)}
                          className="rounded-2xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark"
                      >
                          Xác nhận
                      </button>
                  </div>
              </div>
          </div>
      ) : null}
    </div>
  );
}
