const UTILITY_ITEMS = [
  { key: "events", label: "Sự kiện", icon: "calendar_month" },
  { key: "notifications", label: "Thông báo", icon: "notifications" },
  { key: "history", label: "Lịch sử hoạt động", icon: "history" },
  { key: "statistics", label: "Thống kê", icon: "bar_chart" },
  { key: "evidence", label: "Khai báo minh chứng", icon: "verified_user" },
  { key: "evaluation", label: "Phiếu rèn luyện", icon: "assignment" },
];

export default function StudentUtilitiesPanel({ onNavigate, unreadCount = 0, isMonitor = false, onLogout }) {
  const monitorItem = isMonitor
    ? [{ key: "manage-class", label: "Quản lý lớp", icon: "groups" }]
    : [];

  const utilityItems = [...UTILITY_ITEMS, ...monitorItem];

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Tiện ích</h2>
        <p className="mt-1 text-sm text-slate-500">Truy cập nhanh các tính năng phụ trợ.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {utilityItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate?.(item.key)}
            className="relative rounded-2xl border border-slate-200 bg-white px-3 py-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
          >
            <span className="material-symbols-outlined text-xl text-primary">{item.icon}</span>
            {item.key === "notifications" && unreadCount > 0 ? (
              <span className="absolute right-2 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            ) : null}
            <p className="mt-2 text-sm font-semibold text-slate-800">{item.label}</p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
      >
        Đăng xuất
      </button>
    </section>
  );
}

