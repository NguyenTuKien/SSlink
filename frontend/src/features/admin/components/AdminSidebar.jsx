export default function AdminSidebar({
  items,
  activeFeature,
  onSelect,
  fullNameLabel,
  userIdLabel,
  avatarLetter,
  lecturerStats,
  studentStats,
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-200 bg-white/95 p-4 backdrop-blur-md md:flex">
      <div className="flex items-center gap-3 px-2 py-2.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white overflow-hidden shadow-lg">
          <img src="/image.png" alt="Logo" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">UniPoint Admin</h1>
          <p className="text-sm font-semibold text-slate-600">Trang quản lý của admin</p>
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-2 overflow-y-auto px-1">
        {items.map((item) => {
          const isActive = activeFeature === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={
                isActive
                  ? "flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-white shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5"
                  : "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-slate-600 transition-all hover:bg-slate-100 hover:text-primary"
              }
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <p className="flex-1 text-left text-base font-bold">{item.label}</p>
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-200 px-1 pt-4">
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Trạng thái hệ thống</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Giảng viên</span>
              <strong className="text-slate-900">{lecturerStats?.totalLecturers ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Sinh viên</span>
              <strong className="text-slate-900">{studentStats?.totalStudents ?? 0}</strong>
            </div>
            <div className="h-1.5 rounded-full bg-rose-100">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-primary to-rose-400"
                style={{ width: `${lecturerStats?.totalLecturers ? Math.round((lecturerStats.activeLecturers / lecturerStats.totalLecturers) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
