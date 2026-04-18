export default function AdminTopHeader({ fullNameLabel, userIdLabel, avatarLetter, searchValue, onSearchChange, onLogout }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-rose-100 bg-white/85 px-4 py-3 backdrop-blur-md md:ml-72 md:px-8">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative hidden w-full max-w-xl md:block">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">search</span>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:bg-white"
            placeholder="Tìm giảng viên, mã, email hoặc khoa..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden gap-2 md:flex">
          <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors" type="button">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-3 md:pl-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900">{fullNameLabel}</p>
            <p className="text-[10px] text-slate-500">{userIdLabel}</p>
          </div>
          <div className="size-10 rounded-full border-2 border-primary bg-primary/10 text-primary flex items-center justify-center font-bold">
            {avatarLetter}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-colors hover:bg-red-100 sm:flex"
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

