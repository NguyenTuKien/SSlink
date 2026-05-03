const UTILITIES_FEATURES = new Set([
  "events",
  "notifications",
  "history",
  "statistics",
  "evidence",
  "evaluation",
  "manage-class",
  "face-profile",
  "utilities",
  "quizzes",
]);

export default function StudentMobileNav({ activeFeature, onSelect, unreadCount = 0 }) {
  const isUtilitiesActive = UTILITIES_FEATURES.has(activeFeature);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-2 border-t border-primary/10 bg-white/95 px-3 pt-2 backdrop-blur-md dark:bg-slate-900/95 md:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={() => onSelect("dashboard")}
        className={`flex-1 min-h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 ${activeFeature === "dashboard" ? "text-primary bg-primary/10" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">house</span>
        <span className="text-[10px] font-medium">Trang chủ</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("scan-qr")}
        className={`flex-1 min-h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 ${activeFeature === "scan-qr" ? "text-primary bg-primary/10" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">qr_code_scanner</span>
        <span className="text-[10px] font-medium">Quét mã</span>
      </button>
      <button
        type="button"
        onClick={() => onSelect("utilities")}
        className={`relative flex-1 min-h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 ${isUtilitiesActive ? "text-primary bg-primary/10" : "text-slate-400"}`}
      >
        <span className="material-symbols-outlined">apps</span>
        {unreadCount > 0 ? (
          <span className="absolute right-3 top-1 rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
        <span className="text-[10px] font-medium">Tiện ích</span>
      </button>
    </div>
  );
}
