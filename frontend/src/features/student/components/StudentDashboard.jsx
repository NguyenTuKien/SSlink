import { useAuth } from "../../../context/AuthContext";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useStudentScoreTrend } from "../hooks/useStudentScoreTrend";

function getGreetingName(name) {
    if (!name) {
        return "bạn";
    }
    const parts = String(name).split(" ").filter(Boolean);
    return parts[parts.length - 1] || name;
}

function parseUiDate(createdAt) {
    if (!createdAt) {
        return null;
    }
    const [datePart] = String(createdAt).split(" ");
    if (!datePart) {
        return null;
    }
    const [dd, mm, yyyy] = datePart.split("/").map(Number);
    if (!dd || !mm || !yyyy) {
        return null;
    }
    return new Date(yyyy, mm - 1, dd);
}

function getHistoryDateLabel(createdAt) {
    const date = parseUiDate(createdAt);
    if (!date) {
        return "GẦN ĐÂY";
    }

    const current = new Date();
    current.setHours(0, 0, 0, 0);

    const compare = new Date(date);
    compare.setHours(0, 0, 0, 0);

    const diffDays = Math.round((current - compare) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        return "HÔM NAY";
    }
    if (diffDays === 1) {
        return "HÔM QUA";
    }

    const day = String(compare.getDate()).padStart(2, "0");
    const month = compare.getMonth() + 1;
    return `${day} THG ${month}`;
}

function getHistoryHint(status) {
    switch (status) {
        case "APPROVED":
            return "+2 điểm rèn luyện";
        case "REJECTED":
            return "Cần cập nhật minh chứng";
        default:
            return "Đang chờ duyệt";
    }
}

function statusPill(status) {
    const upper = String(status || "PENDING").toUpperCase();
    if (upper === "APPROVED") {
        return "border border-green-200 bg-green-50 text-green-700";
    }
    if (upper === "REJECTED") {
        return "border border-red-200 bg-red-50 text-red-700";
    }
    return "border border-yellow-200 bg-yellow-50 text-yellow-700";
}

function statusLabel(status) {
    const upper = String(status || "PENDING").toUpperCase();
    if (upper === "APPROVED") return "Đã duyệt";
    if (upper === "REJECTED") return "Từ chối";
    return "Chờ duyệt";
}

export default function StudentDashboard({ onNavigate }) {
    const { user } = useAuth();
    const { dashboard, loading, error } = useStudentDashboard(user?.userId);
    const { trend, loading: trendLoading, error: trendError } = useStudentScoreTrend(user?.userId);

    if (loading) {
        return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải dashboard sinh viên...</div>;
    }

    if (error) {
        return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Không thể tải dữ liệu: {error}</div>;
    }

    if (!dashboard) {
        return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Không có dữ liệu dashboard.</div>;
    }

    const safeScore = Math.max(0, Math.min(100, Number(dashboard.totalScore) || 0));
    const upcomingEvents = Array.isArray(dashboard.upcomingEvents) ? dashboard.upcomingEvents : [];
    const attendedEvents = Array.isArray(dashboard.attendedEvents) ? dashboard.attendedEvents : [];
    const history = Array.isArray(dashboard.history) ? dashboard.history : [];
    const greetingName = getGreetingName(dashboard.fullName);
    const pendingCount = history.filter((item) => String(item?.status || "").toUpperCase() === "PENDING").length;
    const approvedCount = history.filter((item) => String(item?.status || "").toUpperCase() === "APPROVED").length;
    const latestHistory = history.slice(0, 5);
    const latestEvents = upcomingEvents.slice(0, 4);

    return (
        <main className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-primary/10 via-white to-red-50 p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Chào {greetingName},</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            {dashboard.classCode || "--"} · {dashboard.facultyName || "Khoa chưa cập nhật"}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                            Bạn có <strong>{pendingCount}</strong> minh chứng đang chờ duyệt và đã hoàn thành <strong>{approvedCount}</strong> minh chứng.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                            onClick={() => onNavigate?.("scan-qr")}
                        >
                            <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                            Quét QR
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                            onClick={() => onNavigate?.("evidence")}
                        >
                            <span className="material-symbols-outlined text-base">task_alt</span>
                            Khai báo minh chứng
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => onNavigate?.("evaluation")}
                        >
                            <span className="material-symbols-outlined text-base">assignment</span>
                            Phiếu rèn luyện
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Điểm rèn luyện</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                        {safeScore}
                        <span className="text-base font-semibold text-slate-500">/100</span>
                    </p>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                        <span className="block h-2 rounded-full bg-primary" style={{ width: `${safeScore}%` }} />
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Sự kiện đã tham gia</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.joinedActivities ?? attendedEvents.length ?? 0}</p>
                    <p className="mt-2 text-xs text-slate-500">Tổng số hoạt động trong học kỳ hiện tại</p>
                </article>

                <article className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-yellow-700">Minh chứng chờ duyệt</p>
                    <p className="mt-2 text-3xl font-bold text-yellow-700">{pendingCount}</p>
                    <button
                        type="button"
                        className="mt-3 text-xs font-semibold text-yellow-700 hover:underline"
                        onClick={() => onNavigate?.("evidence")}
                    >
                        Xem danh sách minh chứng
                    </button>
                </article>

                <article className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-green-700">Sắp diễn ra</p>
                    <p className="mt-2 text-3xl font-bold text-green-700">{latestEvents.length}</p>
                    <button
                        type="button"
                        className="mt-3 text-xs font-semibold text-green-700 hover:underline"
                        onClick={() => onNavigate?.("events")}
                    >
                        Xem sự kiện
                    </button>
                </article>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">Lịch sử hoạt động gần đây</h2>
                        <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline"
                            onClick={() => onNavigate?.("history")}
                        >
                            Xem tất cả
                        </button>
                    </div>

                    {latestHistory.length === 0 ? (
                        <p className="text-sm text-slate-500">Chưa có dữ liệu hoạt động.</p>
                    ) : (
                        <div className="space-y-3">
                            {latestHistory.map((item) => (
                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{item.title || "Hoạt động"}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {getHistoryDateLabel(item.createdAt)} · {getHistoryHint((item.status || "PENDING").toUpperCase())}
                                        </p>
                                    </div>
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(item.status)}`}>
                                        {statusLabel(item.status)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-bold text-slate-900">Việc cần làm</h2>
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => onNavigate?.("evidence")}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                        >
                            <p className="text-sm font-semibold text-slate-800">Kiểm tra minh chứng</p>
                            <p className="mt-1 text-xs text-slate-500">{pendingCount} minh chứng chờ duyệt</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate?.("events")}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                        >
                            <p className="text-sm font-semibold text-slate-800">Xem sự kiện sắp tới</p>
                            <p className="mt-1 text-xs text-slate-500">{latestEvents.length} sự kiện trong lịch gần nhất</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate?.("evaluation")}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                        >
                            <p className="text-sm font-semibold text-slate-800">Cập nhật phiếu rèn luyện</p>
                            <p className="mt-1 text-xs text-slate-500">Theo dõi tiến độ và điểm từng học kỳ</p>
                        </button>
                    </div>
                </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Xu hướng điểm theo học kỳ</h2>
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onNavigate?.("statistics")}>
                        Xem thống kê
                    </button>
                </div>

                {trendLoading ? (
                    <p className="text-sm text-slate-500">Đang tải xu hướng điểm...</p>
                ) : trendError ? (
                    <p className="text-sm text-red-600">{trendError}</p>
                ) : trend.length === 0 ? (
                    <p className="text-sm text-slate-500">Chưa có dữ liệu điểm theo học kỳ.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {trend.map((item) => {
                            const trendScore = Math.max(0, Math.min(100, Number(item.finalScore) || 0));
                            const delta = Number(item.deltaFromPrevious);
                            const hasDelta = Number.isFinite(delta);
                            const deltaLabel = hasDelta ? `${delta > 0 ? "+" : ""}${delta}` : "--";
                            const deltaClass = !hasDelta
                                ? "text-slate-500"
                                : delta > 0
                                    ? "text-green-600"
                                    : delta < 0
                                        ? "text-red-600"
                                        : "text-slate-500";

                            return (
                                <article key={`${item.semesterId}-${item.semesterName}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <p className="text-sm font-semibold text-slate-800">{item.semesterName || "Học kỳ"}</p>
                                        <span className={`text-xs font-semibold ${deltaClass}`}>Δ {deltaLabel}</span>
                                    </div>
                                    <p className="text-sm text-slate-700">{trendScore}/100 · {item.rankLabel || "--"}</p>
                                    <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                                        <span className="block h-2 rounded-full bg-primary" style={{ width: `${trendScore}%` }} />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}
