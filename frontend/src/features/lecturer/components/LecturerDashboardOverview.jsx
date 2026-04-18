const KPI_CARDS = [
    {
        id: "events",
        label: "Tổng sự kiện",
        valueKey: "totalEvents",
        icon: "event",
        color: "text-blue-600",
        bg: "bg-blue-100",
    },
    {
        id: "students",
        label: "Sinh viên tham gia",
        valueKey: "participatingStudents",
        icon: "groups",
        color: "text-emerald-600",
        bg: "bg-emerald-100",
    },
    {
        id: "pending",
        label: "Minh chứng chờ duyệt",
        valueKey: "pendingEvidence",
        icon: "assignment_late",
        color: "text-amber-600",
        bg: "bg-amber-100",
    },
    {
        id: "managedStudents",
        label: "Sinh viên quản lý",
        valueKey: "totalStudents",
        icon: "groups",
        color: "text-rose-600",
        bg: "bg-rose-100",
    },
];

const SCORE_DISTRIBUTION_META = [
    { key: "excellent", label: "Xuất sắc", color: "bg-primary" },
    { key: "good", label: "Tốt", color: "bg-blue-500" },
    { key: "fair", label: "Khá", color: "bg-amber-500" },
    { key: "average", label: "Trung bình", color: "bg-slate-400" },
];

function formatNumber(value) {
    const safe = Number(value);
    return new Intl.NumberFormat("vi-VN").format(Number.isFinite(safe) ? safe : 0);
}

function formatPercent(value) {
    const safe = Number(value);
    if (!Number.isFinite(safe)) {
        return "0%";
    }
    const rounded = Math.round(safe * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function normalizeDistribution(summary) {
    const rawItems = Array.isArray(summary?.scoreDistribution) ? summary.scoreDistribution : [];
    const byKey = rawItems.reduce((acc, item) => {
        if (item?.key) {
            acc[item.key] = Number(item.percentage) || 0;
        }
        return acc;
    }, {});

    return SCORE_DISTRIBUTION_META.map((meta) => ({
        ...meta,
        percentage: Math.max(0, Math.min(100, byKey[meta.key] ?? 0)),
    }));
}

export default function LecturerDashboardOverview({ summary, onCreateEvent, loadingSummary = false }) {
    const resolvedSummary = {
        totalEvents: Number(summary?.totalEvents) || 0,
        totalStudents: Number(summary?.totalStudents) || 0,
        participatingStudents: Number(summary?.participatingStudents) || 0,
        pendingEvidence: Number(summary?.pendingEvidence) || 0,
        newNotifications: Number(summary?.newNotifications) || 0,
    };

    const passRate = Math.max(0, Math.min(100, Number(summary?.passRate) || 0));
    const scoreDistribution = normalizeDistribution(summary);
    const upcomingEvents = Array.isArray(summary?.upcomingEvents) ? summary.upcomingEvents.slice(0, 5) : [];

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-primary/10 via-white to-red-50 p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Dashboard Giảng viên</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Tổng quan lớp phụ trách, tiến độ duyệt minh chứng và sức khỏe điểm rèn luyện theo học kỳ.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onCreateEvent}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-base">add_circle</span>
                            Tạo sự kiện
                        </button>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {KPI_CARDS.map((card) => (
                    <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
                                <p className="mt-2 text-3xl font-bold text-slate-900">
                                    {formatNumber(resolvedSummary[card.valueKey])}
                                </p>
                            </div>
                            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                                <span className="material-symbols-outlined">{card.icon}</span>
                            </span>
                        </div>
                    </article>
                ))}
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900">Sự kiện sắp diễn ra</h2>
                        <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={onCreateEvent}>
                            Tạo thêm sự kiện
                        </button>
                    </div>

                    {loadingSummary ? (
                        <p className="text-sm text-slate-500">Đang tải dữ liệu sự kiện...</p>
                    ) : upcomingEvents.length === 0 ? (
                        <p className="text-sm text-slate-500">Chưa có sự kiện sắp tới trong kỳ này.</p>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map((event, index) => (
                                <div key={event.id ?? `${event.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{event.title || "Sự kiện chưa đặt tên"}</p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {event.dateLabel || "--/--/----"} · {event.timeLabel || "--:-- - --:--"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">{event.location || "Địa điểm chưa cập nhật"}</p>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">Đã đăng ký</p>
                                            <p className="text-lg font-bold text-slate-900">{formatNumber(event.attendeeCount)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">Ưu tiên xử lý</h2>
                    <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-amber-700">Minh chứng đang chờ</p>
                            <p className="mt-1 text-2xl font-bold text-amber-700">{formatNumber(resolvedSummary.pendingEvidence)}</p>
                            <p className="mt-1 text-xs text-amber-700">Nên xử lý trong ngày để tránh dồn backlog.</p>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-rose-700">Thông báo mới</p>
                            <p className="mt-1 text-2xl font-bold text-rose-700">{formatNumber(resolvedSummary.newNotifications)}</p>
                            <p className="mt-1 text-xs text-rose-700">Kiểm tra phản hồi từ lớp và hệ thống.</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Tỷ lệ đạt điểm chuẩn</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">{formatPercent(passRate)}</p>
                            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                                <span className="block h-2 rounded-full bg-primary" style={{ width: `${passRate}%` }} />
                            </div>
                        </div>
                    </div>
                </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Phân bố điểm rèn luyện</h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {scoreDistribution.map((item) => (
                        <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                                <p className="text-sm font-bold text-slate-900">{formatPercent(item.percentage)}</p>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-200">
                                <span className={`block h-2 rounded-full ${item.color}`} style={{ width: `${item.percentage}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
