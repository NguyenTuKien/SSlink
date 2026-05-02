import { useEffect, useMemo, useRef, useState } from "react";

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

export default function AdminStudentManagement({ studentWorkspace, onNavigate }) {
    const {
        rows,
        stats,
        filters,
        setFilters,
        loading,
        busy,
        flash,
        selectedStudent,
        selectedStudentId,
        setSelectedStudentId,
        updateStudent,
        deleteStudent,
        importStudents,
        exportStudents,
    } = studentWorkspace;
    const fileInputRef = useRef(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [showErrors, setShowErrors] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredCount = rows.length;
    const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

    const pageRows = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return rows.slice(startIndex, startIndex + PAGE_SIZE);
    }, [currentPage, rows]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);
    const [editForm, setEditForm] = useState({
        fullName: "",
        studentCode: "",
        email: "",
        username: "",
        password: "",
        classId: "",
        role: "STUDENT",
        status: "ACTIVE",
    });

    useEffect(() => {
        if (!selectedStudent) {
            return;
        }
        setEditForm({
            fullName: selectedStudent.fullName || "",
            studentCode: selectedStudent.studentCode || "",
            email: selectedStudent.email || "",
            username: selectedStudent.username || "",
            password: "",
            classId: selectedStudent.classId ? String(selectedStudent.classId) : "",
            role: selectedStudent.role || "STUDENT",
            status: selectedStudent.status || "ACTIVE",
        });
        setIsEditing(false);
    }, [selectedStudent]);

    const hasPendingChanges = useMemo(() => {
        if (!selectedStudent) {
            return false;
        }

        return (
            editForm.fullName.trim() !== (selectedStudent.fullName || "") ||
            editForm.studentCode.trim() !== (selectedStudent.studentCode || "") ||
            editForm.email.trim() !== (selectedStudent.email || "") ||
            editForm.username.trim() !== (selectedStudent.username || "") ||
            String(editForm.classId || "") !== String(selectedStudent.classId || "") ||
            editForm.role !== (selectedStudent.role || "STUDENT") ||
            editForm.status !== (selectedStudent.status || "ACTIVE") ||
            Boolean(editForm.password.trim())
        );
    }, [editForm, selectedStudent]);

    const classesByFaculty = useMemo(
        () => studentWorkspace.options.classes.filter(
            (classItem) => !filters.facultyId || String(classItem.facultyId) === String(filters.facultyId),
        ),
        [studentWorkspace.options.classes, filters.facultyId],
    );

    const handleUpdateStudent = async () => {
        if (!selectedStudent) {
            return;
        }

        if (!hasPendingChanges) {
            setIsEditing(false);
            return;
        }

        await updateStudent(selectedStudent.studentId, {
            fullName: editForm.fullName,
            studentCode: editForm.studentCode,
            email: editForm.email,
            username: editForm.username,
            password: editForm.password,
            classId: Number(editForm.classId),
            role: editForm.role,
            status: editForm.status,
        });
        setIsEditing(false);
        setEditForm((previous) => ({ ...previous, password: "" }));
    };

    const handleToggleStatus = async () => {
        if (!selectedStudent || selectedStudent.status === "DELETED") {
            return;
        }

        const nextStatus = selectedStudent.status === "LOCKED" ? "ACTIVE" : "LOCKED";

        await updateStudent(selectedStudent.studentId, {
            fullName: selectedStudent.fullName,
            studentCode: selectedStudent.studentCode,
            email: selectedStudent.email,
            username: selectedStudent.username,
            password: "",
            classId: selectedStudent.classId,
            role: selectedStudent.role,
            status: nextStatus,
        });
    };

    const handleDeleteStudent = async () => {
        if (!selectedStudent) {
            return;
        }
        const confirmed = window.confirm(
            `Xóa sinh viên ${selectedStudent.fullName}?\nHệ thống sẽ chuyển trạng thái sang Đã xóa (không xóa cứng dữ liệu).`,
        );
        if (!confirmed) {
            return;
        }
        await deleteStudent(selectedStudent.studentId);
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleImportFile = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) {
            return;
        }
        setIsImporting(true);
        try {
            const result = await importStudents(files);
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
        const { blob, fileName } = await exportStudents();
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
                Đang tải dữ liệu sinh viên...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl space-y-2">
                        <p className="text-xl font-extrabold uppercase tracking-[0.2em] text-primary">Danh sách sinh viên</p>
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
                            onClick={() => onNavigate?.("createStudent")}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                        >
                            <span className="material-symbols-outlined text-base">person_add</span>
                            Thêm sinh viên
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    accept=".xlsx,.xls"
                    onChange={handleImportFile}
                />

                {flash.message ? (
                    <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${flash.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10 dark:text-rose-200" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-200"}`}>
                        {flash.message}
                    </div>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
                    <StatChip label="Tổng" value={stats.totalStudents ?? 0} />
                    <StatChip label="Hoạt động" value={stats.activeStudents ?? 0} />
                    <StatChip label="Monitor" value={stats.monitorStudents ?? 0} />
                    <StatChip label="Bị khóa" value={stats.lockedStudents ?? 0} />
                    <StatChip label="Đã xóa" value={stats.deletedStudents ?? 0} />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
                    <input
                        type="search"
                        value={filters.keyword}
                        onChange={(event) => setFilters((previous) => ({ ...previous, keyword: event.target.value }))}
                        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
                        placeholder="Tìm theo tên, mã, email, lớp..."
                    />
                    <select
                        value={filters.facultyId}
                        onChange={(event) => setFilters((previous) => ({ ...previous, facultyId: event.target.value, classId: "" }))}
                        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
                    >
                        <option value="">Tất cả khoa</option>
                        {studentWorkspace.options.faculties.map((faculty) => (
                            <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                        ))}
                    </select>
                    <select
                        value={filters.classId}
                        onChange={(event) => setFilters((previous) => ({ ...previous, classId: event.target.value }))}
                        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
                    >
                        <option value="">Tất cả lớp</option>
                        {classesByFaculty.map((classItem) => (
                            <option key={classItem.id} value={classItem.id}>{classItem.classCode}</option>
                        ))}
                    </select>
                    <select
                        value={filters.status}
                        onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}
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
                        <h2 className="text-lg font-bold text-slate-900">Bảng sinh viên</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">Sinh viên</th>
                                    <th className="px-6 py-4">Lớp / Khoa</th>
                                    <th className="px-6 py-4">Vai trò</th>
                                    <th className="px-6 py-4">Trạng thái</th>
                                    <th className="px-6 py-4 text-right">Tạo lúc</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pageRows.length > 0 ? pageRows.map((student) => {
                                    const isSelected = selectedStudentId === student.studentId;
                                    return (
                                        <tr
                                            key={student.studentId}
                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-slate-50"}`}
                                            onClick={() => setSelectedStudentId(student.studentId)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-slate-900">{student.fullName}</p>
                                                    <p className="text-xs text-slate-500">{student.studentCode} · {student.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">
                                                <div className="space-y-1">
                                                    <p>{student.classCode || "Chưa có lớp"}</p>
                                                    <p className="text-xs text-slate-500">{student.facultyName || "Chưa có khoa"}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">{student.role || "STUDENT"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[student.status] || "bg-slate-100 text-slate-600"}`}>
                                                    {STATUS_LABELS[student.status] || student.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-slate-500">{student.createdAt || "--"}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={5}>
                                            Không có sinh viên nào phù hợp bộ lọc hiện tại.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                            <span className="text-sm text-slate-500">
                                Hiển thị {(currentPage - 1) * PAGE_SIZE + (pageRows.length ? 1 : 0)} - {(currentPage - 1) * PAGE_SIZE + pageRows.length} trong tổng số {filteredCount} sinh viên
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
                            <h2 className="text-lg font-bold text-slate-900">Chi tiết sinh viên</h2>
                            <p className="text-sm text-slate-500">Xem nhanh bản ghi đang chọn.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{rows.length} bản ghi</span>
                    </div>

                    {selectedStudent ? (
                        <div className="mt-6 space-y-5">
                            <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 p-5 shadow-sm">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{selectedStudent.studentCode}</p>
                                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{selectedStudent.fullName}</h3>
                                <p className="mt-2 text-sm text-slate-600">{selectedStudent.email}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <StatChip label="Lớp" value={selectedStudent.classCode || "--"} />
                                <StatChip label="Khoa" value={selectedStudent.facultyName || "--"} />
                                <StatChip label="Vai trò" value={selectedStudent.role || "STUDENT"} />
                                <StatChip label="Trạng thái" value={STATUS_LABELS[selectedStudent.status] || selectedStudent.status} />
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
                                        disabled={busy || selectedStudent.status === "DELETED"}
                                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {selectedStudent.status === "LOCKED" ? "Mở khóa" : "Khóa tài khoản"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteStudent}
                                        disabled={busy || selectedStudent.status === "DELETED"}
                                        className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Xóa sinh viên
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Chưa chọn sinh viên nào.</div>
                    )}
                </article>
            </section>

            {isEditing && selectedStudent ? (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/30 p-4">
                    <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Chỉnh sửa sinh viên</h3>
                                <p className="text-sm text-slate-500">Cập nhật thông tin cho {selectedStudent.fullName}</p>
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
                                onChange={(event) => setEditForm((previous) => ({ ...previous, fullName: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                                placeholder="Họ và tên"
                            />
                            <input
                                value={editForm.studentCode}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, studentCode: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                                placeholder="Mã sinh viên"
                            />
                            <input
                                value={editForm.email}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                                placeholder="Email"
                            />
                            <input
                                value={editForm.username}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, username: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                                placeholder="Username"
                            />
                            <select
                                value={editForm.classId}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, classId: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                            >
                                <option value="">Chọn lớp</option>
                                {studentWorkspace.options.classes.map((classItem) => (
                                    <option key={classItem.id} value={classItem.id}>{classItem.classCode}</option>
                                ))}
                            </select>
                            <select
                                value={editForm.role}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, role: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                            >
                                <option value="STUDENT">Sinh viên</option>
                                <option value="MONITOR">Monitor</option>
                            </select>
                            <select
                                value={editForm.status}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, status: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                            >
                                <option value="ACTIVE">Hoạt động</option>
                                <option value="LOCKED">Bị khóa</option>
                                <option value="DELETED">Đã xóa</option>
                            </select>
                            <input
                                type="password"
                                value={editForm.password}
                                onChange={(event) => setEditForm((previous) => ({ ...previous, password: event.target.value }))}
                                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                                placeholder="Mật khẩu mới (để trống nếu không đổi)"
                            />
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
                                onClick={handleUpdateStudent}
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
                <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Kết quả Import</h3>
                                <p className="text-sm text-slate-500">Trạng thái xử lý danh sách sinh viên</p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col items-center gap-2">
                            <div className="grid grid-cols-2 gap-4 w-full text-center">
                                <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                                    <p className="text-3xl font-black text-emerald-600">{importResult.importedCount || 0}</p>
                                    <p className="text-xs font-bold uppercase text-emerald-700 mt-1">Thành công</p>
                                </div>
                                <div className={`rounded-2xl p-4 border ${importResult.skippedCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className={`text-3xl font-black ${importResult.skippedCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{importResult.skippedCount || 0}</p>
                                    <p className={`text-xs font-bold uppercase mt-1 ${importResult.skippedCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Bỏ qua/Lỗi</p>
                                </div>
                            </div>
                            
                            {(importResult.errors?.length > 0) && (
                                <button 
                                    onClick={() => setShowErrors(!showErrors)}
                                    className="mt-2 text-sm font-semibold text-primary underline"
                                >
                                    {showErrors ? "Ẩn chi tiết lỗi" : "Xem chi tiết lỗi"}
                                </button>
                            )}

                            {showErrors && importResult.errors?.length > 0 && (
                                <div className="mt-2 w-full max-h-48 overflow-y-auto rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700 text-left space-y-1">
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
