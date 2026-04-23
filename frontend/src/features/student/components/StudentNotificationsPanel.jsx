import { useEffect, useMemo, useState } from "react";
import {
    downloadStudentNotificationAttachment,
    getStudentNotifications,
    markStudentNotificationAsRead,
} from "../../../api/notificationStatisticsApi";

function openBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "attachment";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export default function StudentNotificationsPanel({ onUnreadCountChange }) {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(0);
    const [size] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyRecipientId, setBusyRecipientId] = useState(null);

    useEffect(() => {
        let ignore = false;

        async function fetchData() {
            setLoading(true);
            setError("");
            try {
                const payload = await getStudentNotifications({ page, size });
                if (ignore) {
                    return;
                }

                const nextItems = Array.isArray(payload?.items) ? payload.items : [];
                const nextUnread = Number(payload?.unreadCount || 0);

                setItems(nextItems);
                setTotalPages(Number(payload?.totalPages || 0));
                setTotalItems(Number(payload?.totalItems || 0));
                setUnreadCount(nextUnread);
                if (typeof onUnreadCountChange === "function") {
                    onUnreadCountChange(nextUnread);
                }
            } catch (err) {
                if (!ignore) {
                    setError(err.message || "Không tải được danh sách thông báo.");
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            ignore = true;
        };
    }, [onUnreadCountChange, page, size]);

    const hasNotifications = useMemo(() => items.length > 0, [items]);

    async function handleMarkAsRead(recipientId) {
        if (!recipientId) {
            return;
        }

        setBusyRecipientId(recipientId);
        try {
            await markStudentNotificationAsRead(recipientId);
            setItems((prev) =>
                prev.map((item) => (item.recipientId === recipientId ? { ...item, isRead: true } : item)),
            );
            const nextUnread = Math.max(unreadCount - 1, 0);
            setUnreadCount(nextUnread);
            if (typeof onUnreadCountChange === "function") {
                onUnreadCountChange(nextUnread);
            }
        } catch (err) {
            alert(err.message || "Không thể đánh dấu đã đọc.");
        } finally {
            setBusyRecipientId(null);
        }
    }

    async function handleDownloadAttachment(recipientId) {
        if (!recipientId) {
            return;
        }

        setBusyRecipientId(recipientId);
        try {
            const { blob, fileName } = await downloadStudentNotificationAttachment(recipientId);
            openBlobDownload(blob, fileName);
        } catch (err) {
            alert(err.message || "Không thể tải file đính kèm.");
        } finally {
            setBusyRecipientId(null);
        }
    }

    if (loading) {
        return <div className="p-6 text-slate-500">Đang tải thông báo...</div>;
    }

    if (error) {
        return <div className="p-6 text-red-500">Lỗi: {error}</div>;
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Thông báo của bạn</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Nhận thông báo từ giảng viên, đánh dấu đã đọc và tải file đính kèm.
                    </p>
                </div>
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    Chưa đọc: {unreadCount}
                </span>
            </div>

            {!hasNotifications ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
                    Chưa có thông báo nào.
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => {
                        const isUnread = !item.isRead;
                        return (
                            <article
                                key={item.recipientId}
                                className={`rounded-xl border p-4 ${isUnread
                                        ? "border-blue-200 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20"
                                        : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                                    }`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">{item.title}</h4>
                                        <p className="mt-1 text-xs text-slate-500 break-words">{item.createdAt || "--"} - {item.senderName || "Giảng viên"}</p>
                                    </div>
                                    <span
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isUnread
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                            }`}
                                    >
                                        {isUnread ? "Chưa đọc" : "Đã đọc"}
                                    </span>
                                </div>

                                <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 break-words">{item.content || "(Không có nội dung)"}</p>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {isUnread && (
                                        <button
                                            type="button"
                                            disabled={busyRecipientId === item.recipientId}
                                            onClick={() => handleMarkAsRead(item.recipientId)}
                                            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                        >
                                            Đánh dấu đã đọc
                                        </button>
                                    )}

                                    {item.attachmentDownloadUrl && (
                                        <button
                                            type="button"
                                            disabled={busyRecipientId === item.recipientId}
                                            onClick={() => handleDownloadAttachment(item.recipientId)}
                                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                        >
                                            Tải file đính kèm
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                        type="button"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50 sm:w-auto"
                        disabled={page <= 0}
                        onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                    >
                        Trước
                    </button>
                    <span className="px-2 text-sm text-slate-600 dark:text-slate-300">
                        Trang {page + 1}/{Math.max(totalPages, 1)} - Tổng {totalItems}
                    </span>
                    <button
                        type="button"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50 sm:w-auto"
                        disabled={page + 1 >= totalPages}
                        onClick={() => setPage((prev) => prev + 1)}
                    >
                        Sau
                    </button>
                </div>
            )}
        </section>
    );
}
