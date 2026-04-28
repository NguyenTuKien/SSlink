export default function StudentMobileNav({ activeFeature, onSelect, onLogout, unreadCount = 0 }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 overflow-x-auto bg-white dark:bg-slate-900 border-t border-primary/10 flex justify-around py-2 z-50">
      <button
        type="button"
        onClick={() => onSelect("dashboard")}
        className={`flex flex-col items-center gap-1 ${activeFeature === "dashboard" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">house</span>
        <span className="text-[10px] font-medium">Trang chủ</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("events")}
        className={`flex flex-col items-center gap-1 ${activeFeature === "events" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">calendar_today</span>
        <span className="text-[10px] font-medium">Sự kiện</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("notifications")}
        className={`relative flex flex-col items-center gap-1 ${activeFeature === "notifications" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
        <span className="text-[10px] font-medium">Thông báo</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("scan-qr")}
        className={`flex flex-col items-center gap-1 ${activeFeature === "scan-qr" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">qr_code_scanner</span>
        <span className="text-[10px] font-medium">Quét mã</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("face-profile")}
        className={`flex flex-col items-center gap-1 ${activeFeature === "face-profile" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">face</span>
        <span className="text-[10px] font-medium">Face</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("history")}
        className={`flex flex-col items-center gap-1 ${activeFeature === "history" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">history</span>
        <span className="text-[10px] font-medium">Lịch sử</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("statistics")}
        className={`flex flex-col items-center gap-1 ${activeFeature === "statistics" ? "text-primary" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">bar_chart</span>
        <span className="text-[10px] font-medium">Thống kê</span>
      </button>
      <button type="button" onClick={onLogout} className="flex flex-col items-center gap-1 text-slate-400">
        <span className="material-symbols-outlined">person</span>
        <span className="text-[10px] font-medium">Cá nhân</span>
      </button>
    </div>
  );
}

