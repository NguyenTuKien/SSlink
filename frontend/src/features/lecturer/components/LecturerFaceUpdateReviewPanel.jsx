import { useEffect, useMemo, useRef, useState } from "react";
import {
  approveFaceUpdateRequest,
  getLecturerFaceUpdateRequests,
  rejectFaceUpdateRequest,
} from "../../../api/faceApi";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
];

function normalizeStatus(status) {
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

function statusLabel(status) {
  const value = normalizeStatus(status);
  if (value === "APPROVED") return "Đã duyệt";
  if (value === "REJECTED") return "Từ chối";
  return "Chờ duyệt";
}

function statusBadgeClass(status) {
  const value = normalizeStatus(status);
  if (value === "APPROVED") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-700/40 dark:bg-green-900/20 dark:text-green-300";
  }
  if (value === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300";
}

function formatDateTime(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LecturerFaceUpdateReviewPanel() {
  const noticeTimerRef = useRef(null);
  const [status, setStatus] = useState("PENDING");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

  useEffect(() => {
    if (!notice.message) {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      return undefined;
    }

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      setNotice({ type: "", message: "" });
      noticeTimerRef.current = null;
    }, 3000);

    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [notice.message]);

  async function loadRequests(options = {}) {
    const { silent = false } = options;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setNotice({ type: "", message: "" });
    }

    try {
      const payload = await getLecturerFaceUpdateRequests({
        status: status || undefined,
        size: 50,
      });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadRequests();
  }, [status]);

  async function handleReview(id, action) {
    setNotice({ type: "", message: "" });
    try {
      const note = reviewNotes[id] || "";
      if (action === "approve") {
        await approveFaceUpdateRequest(id, note);
      } else {
        await rejectFaceUpdateRequest(id, note);
      }
      await loadRequests({ silent: true });
      setNotice({ type: "success", message: "Đã cập nhật trạng thái yêu cầu." });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  }

  const filteredItems = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    if (!search) return items;
    return items.filter((item) => {
      const student = String(item.studentName || "").toLowerCase();
      const classCode = String(item.classCode || "").toLowerCase();
      const reason = String(item.reason || "").toLowerCase();
      return student.includes(search) || classCode.includes(search) || reason.includes(search);
    });
  }, [items, keyword]);

  const stats = useMemo(() => {
    const summary = {
      total: filteredItems.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    filteredItems.forEach((item) => {
      const normalized = normalizeStatus(item.status);
      if (normalized === "APPROVED") {
        summary.approved += 1;
      } else if (normalized === "REJECTED") {
        summary.rejected += 1;
      } else {
        summary.pending += 1;
      }
    });

    return summary;
  }, [filteredItems]);

  const filterLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label || "Tất cả";

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-primary/10">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Hồ sơ khuôn mặt</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Duyệt ảnh khuôn mặt</h2>
          </div>

          <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "ALL"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm kiếm</span>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-base text-slate-400">
                  search
                </span>
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Tìm theo tên sinh viên, lớp, lý do..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </label>

            <button
              type="button"
              onClick={() => loadRequests({ silent: true })}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-base">{refreshing ? "progress_activity" : "refresh"}</span>
              {refreshing ? "Đang cập nhật" : "Làm mới"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Bộ lọc hiện tại</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{filterLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500">Đang hiển thị</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{stats.total} yêu cầu</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-700/40 dark:bg-amber-900/15">
              <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Chờ duyệt</p>
              <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{stats.pending}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50/70 p-3 dark:border-green-700/40 dark:bg-green-900/15">
              <p className="text-xs uppercase tracking-wide text-green-700 dark:text-green-300">Đã duyệt</p>
              <p className="mt-1 text-lg font-bold text-green-700 dark:text-green-300">{stats.approved}</p>
            </div>
          </div>
        </div>

        {notice.message && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${notice.type === "success"
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-700/40 dark:bg-green-900/20 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300"
              }`}
          >
            {notice.message}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Đang tải yêu cầu...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Không tìm thấy yêu cầu phù hợp</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Thử đổi trạng thái hoặc từ khóa tìm kiếm để xem thêm kết quả.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{item.studentName || "--"}</h3>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Lớp: {item.classCode || "--"}</span>
                      <span>Gửi lúc: {formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                  {item.status === "PENDING" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      <span className="material-symbols-outlined text-sm">pending_actions</span>
                      Cần xử lý
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ảnh cũ</p>
                      {item.oldAvatarUrl ? (
                        <img
                          src={item.oldAvatarUrl}
                          alt={`Anh cu ${item.studentName || ""}`}
                          className="h-36 w-full rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                          Chưa có ảnh
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ảnh mới</p>
                      <img
                        src={item.newAvatarUrl}
                        alt={`Anh moi ${item.studentName || ""}`}
                        className="h-36 w-full rounded-xl border border-primary/30 object-cover dark:border-primary/40"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Lý do cập nhật</p>
                      <p className="mt-1">{item.reason || "Không có lý do."}</p>
                    </div>

                    {item.status === "PENDING" ? (
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Ghi chú duyệt
                          </span>
                          <textarea
                            rows={3}
                            value={reviewNotes[item.id] || ""}
                            onChange={(event) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            placeholder="Nhập ghi chú cho kết quả duyệt..."
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(item.id, "approve")}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                          >
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Duyệt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(item.id, "reject")}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                          >
                            <span className="material-symbols-outlined text-base">cancel</span>
                            Từ chối
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ghi chú xử lý</p>
                        <p className="mt-1 text-slate-700 dark:text-slate-300">{item.reviewNote || "Không có ghi chú."}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
