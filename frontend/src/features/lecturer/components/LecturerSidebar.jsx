export default function LecturerSidebar({
  items,
  activeFeature,
  onSelect,
  fullNameLabel,
  userIdLabel,
  avatarLetter,
}) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
      <div className="flex items-center gap-3 p-6">
        <div className="rounded-lg bg-primary p-2 text-white">
          <span className="material-symbols-outlined">school</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-primary">UniPoint Lecture</h1>
      </div>

      <nav className="mt-2 flex-1 space-y-2 px-4">
        {items.map((item) => {
          const isActive = activeFeature === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={
                isActive
                  ? "flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-white shadow-md"
                  : "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition-all hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <p className="flex-1 text-left text-sm font-medium">{item.label}</p>
              {item.badge ? (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{fullNameLabel}</p>
            <p className="truncate text-xs text-slate-500">{userIdLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
