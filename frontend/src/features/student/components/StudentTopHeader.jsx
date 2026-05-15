export default function StudentTopHeader({ fullNameLabel, userIdLabel, avatarLetter, onLogout }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-primary/10 bg-white px-3 py-3 dark:bg-background-dark/50 sm:px-4 md:px-10">
      <div className="flex items-center gap-2 text-primary sm:gap-4">
        <div className="size-8 flex items-center justify-center bg-white rounded-lg overflow-hidden border border-primary/10">
          <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
        </div>
        <h2 className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg">UniPoint</h2>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
        <div className="hidden md:flex gap-2">
          <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors" type="button">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>

        <div className="flex items-center gap-3 pl-2 border-l border-primary/10">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{fullNameLabel}</p>
            <p className="text-[10px] text-slate-500">{userIdLabel}</p>
          </div>
          <div className="size-10 rounded-full border-2 border-primary bg-primary/10 text-primary flex items-center justify-center font-bold">
            {avatarLetter}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="hidden sm:flex items-center justify-center rounded-lg h-10 w-10 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}

