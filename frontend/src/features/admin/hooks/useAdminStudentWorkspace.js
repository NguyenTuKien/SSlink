import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../shared/api/http";
import {
    exportAdminStudentsExcel,
    getAdminStudentImportBatchStatus,
    importAdminStudentsExcel,
} from "../../../api/adminUserExcelApi";

const DEFAULT_FILTERS = {
    keyword: "",
    facultyId: "",
    classId: "",
    status: "",
};

const EMPTY_STATS = {
    totalStudents: 0,
    activeStudents: 0,
    lockedStudents: 0,
    deletedStudents: 0,
    monitorStudents: 0,
    totalFaculties: 0,
    totalClasses: 0,
    facultyBreakdown: [],
    classBreakdown: [],
    recentStudents: [],
};

const EMPTY_FLASH = { type: "", message: "" };
const IMPORT_POLL_INTERVAL_MS = 300;
const IMPORT_POLL_MAX_ATTEMPTS = 300;

function toSearchValue(value) {
    return String(value ?? "").toLowerCase();
}

function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useAdminStudentWorkspace() {
    const [options, setOptions] = useState({ faculties: [], classes: [] });
    const [allRows, setAllRows] = useState([]);
    const [stats, setStats] = useState(EMPTY_STATS);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState(EMPTY_FLASH);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        if (!flash.message) {
            return undefined;
        }

        const timeout = window.setTimeout(() => {
            setFlash(EMPTY_FLASH);
        }, flash.type === "error" ? 6000 : 3000);

        return () => window.clearTimeout(timeout);
    }, [flash]);

    const loadWorkspace = useCallback(
        async ({ silent = false } = {}) => {
            if (!silent) {
                setLoading(true);
                setFlash(EMPTY_FLASH);
            }

            try {
                const [optionsData, listData, statsData] = await Promise.all([
                    apiRequest("/v1/admin/students/options"),
                    apiRequest("/v1/admin/students"),
                    apiRequest("/v1/admin/students/stats"),
                ]);

                const nextRows = listData.students || [];
                setOptions(optionsData || { faculties: [], classes: [] });
                setAllRows(nextRows);
                setStats(statsData || EMPTY_STATS);
            } catch (error) {
                setFlash({ type: "error", message: error.message });
            } finally {
                if (!silent) {
                    setLoading(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        let ignore = false;

        (async () => {
            await loadWorkspace();
            if (!ignore) {
                setLoading(false);
            }
        })();

        return () => {
            ignore = true;
        };
    }, [loadWorkspace]);

    const refresh = useCallback(async () => {
        await loadWorkspace({ silent: true });
    }, [loadWorkspace]);

    const rows = useMemo(() => {
        const keyword = filters.keyword.trim().toLowerCase();
        return allRows.filter((row) => {
            if (filters.facultyId && String(row.facultyId ?? "") !== String(filters.facultyId)) {
                return false;
            }
            if (filters.classId && String(row.classId ?? "") !== String(filters.classId)) {
                return false;
            }
            if (filters.status && String(row.status ?? "") !== String(filters.status)) {
                return false;
            }
            if (!keyword) {
                return true;
            }

            const searchable = [
                row.fullName,
                row.studentCode,
                row.email,
                row.username,
                row.classCode,
                row.facultyName,
                row.role,
                row.createdAt,
            ]
                .map(toSearchValue)
                .join(" ");

            return searchable.includes(keyword);
        });
    }, [allRows, filters.classId, filters.facultyId, filters.keyword, filters.status]);

    useEffect(() => {
        setSelectedStudentId((previous) => {
            if (previous && rows.some((row) => row.studentId === previous)) {
                return previous;
            }
            return rows[0]?.studentId ?? null;
        });
    }, [rows]);

    const createStudent = useCallback(
        async (payload) => {
            setBusy(true);
            try {
                const result = await apiRequest("/v1/admin/students", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                await loadWorkspace({ silent: true });
                setFlash({ type: "success", message: `Đã thêm sinh viên ${result.fullName}.` });
                return result;
            } catch (error) {
                setFlash({ type: "error", message: error.message });
                throw error;
            } finally {
                setBusy(false);
            }
        },
        [loadWorkspace],
    );

    const updateStudent = useCallback(
        async (studentId, payload) => {
            setBusy(true);
            try {
                const result = await apiRequest(`/v1/admin/students/${studentId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });

                await loadWorkspace({ silent: true });
                setFlash({ type: "success", message: `Đã cập nhật sinh viên ${result.fullName}.` });
                return result;
            } catch (error) {
                setFlash({ type: "error", message: error.message });
                throw error;
            } finally {
                setBusy(false);
            }
        },
        [loadWorkspace],
    );

    const deleteStudent = useCallback(
        async (studentId) => {
            setBusy(true);
            try {
                await apiRequest(`/v1/admin/students/${studentId}`, {
                    method: "DELETE",
                });
                await loadWorkspace({ silent: true });
                setFlash({ type: "success", message: "Đã xóa sinh viên." });
            } catch (error) {
                setFlash({ type: "error", message: error.message });
                throw error;
            } finally {
                setBusy(false);
            }
        },
        [loadWorkspace],
    );

    const importStudents = useCallback(
        async (files) => {
            setBusy(true);
            try {
                const fileList = Array.isArray(files) ? files.filter(Boolean) : [files].filter(Boolean);
                if (!fileList.length) {
                    throw new Error("Vui lòng chọn ít nhất một file để import.");
                }

                const file = fileList[0];
                const formData = new FormData();
                formData.append("file", file);

                const enqueue = await importAdminStudentsExcel(formData);
                const batchId = enqueue?.batchId;
                if (!batchId) {
                    throw new Error("Không thể khởi tạo queue import.");
                }

                let attempts = 0;
                let batchStatus = null;
                let currentSleep = 300; // Start fast for small files
                while (attempts < IMPORT_POLL_MAX_ATTEMPTS) {
                    batchStatus = await getAdminStudentImportBatchStatus(batchId);
                    if (batchStatus?.status === "COMPLETED" || batchStatus?.status === "FAILED" || batchStatus?.status === "PARTIAL_SUCCESS") {
                        break;
                    }
                    attempts += 1;
                    await sleep(currentSleep);
                    if (currentSleep < 1500) {
                        currentSleep = Math.min(currentSleep * 1.5, 1500); // Backoff to 1.5s
                    }
                }

                if (batchStatus?.status !== "COMPLETED" && batchStatus?.status !== "FAILED" && batchStatus?.status !== "PARTIAL_SUCCESS") {
                    throw new Error("Queue import đang xử lý quá lâu, vui lòng kiểm tra lại sau.");
                }

                await loadWorkspace({ silent: true });

                const importedCount = Number(batchStatus.importedCount || 0);
                const skippedCount = Number(batchStatus.skippedCount || 0);
                const errorMessages = batchStatus.errors || [];

                if (batchStatus.status === "COMPLETED") {
                    setFlash({ type: "success", message: `Thành công: Đã import ${importedCount} bản ghi.` });
                } else if (batchStatus.status === "PARTIAL_SUCCESS") {
                    setFlash({ type: "warning", message: `Hoàn tất một phần: Đã import ${importedCount}. Bỏ qua ${skippedCount}.` });
                    if (errorMessages.length) {
                        console.error("Lỗi Import:", errorMessages);
                        setFlash({ type: "warning", message: `Import thành công ${importedCount}. Bỏ qua ${skippedCount}. Xem console để biết chi tiết.` });
                    }
                } else {
                    setFlash({ type: "error", message: `Import thất bại: ${errorMessages.join(", ")}` });
                }

                return batchStatus;
            } catch (error) {
                setFlash({ type: "error", message: error.message });
                throw error;
            } finally {
                setBusy(false);
            }
        },
        [loadWorkspace],
    );

    const exportStudents = useCallback(async () => exportAdminStudentsExcel(), []);

    const selectedStudent = useMemo(
        () => rows.find((row) => row.studentId === selectedStudentId) || rows[0] || null,
        [rows, selectedStudentId],
    );

    return {
        options,
        rows,
        stats,
        filters,
        setFilters,
        loading,
        busy,
        flash,
        setFlash,
        refresh,
        createStudent,
        updateStudent,
        deleteStudent,
        importStudents,
        exportStudents,
        selectedStudentId,
        setSelectedStudentId,
        selectedStudent,
    };
}
