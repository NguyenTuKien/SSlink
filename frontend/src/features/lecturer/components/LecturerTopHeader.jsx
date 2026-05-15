export default function LecturerTopHeader({ onLogout }) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 md:px-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-white p-1 overflow-hidden border border-slate-200">
          <img src="/image.png" alt="Logo" className="h-6 w-6 object-cover" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold leading-tight tracking-tight text-primary md:text-lg">UniPoint</h1>
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 md:block">Lecture Portal</p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 md:block" />
        <div className="hidden text-right md:block">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Hệ thống quản lý</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Học kỳ I - 2023-2024</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
          title="Đăng xuất"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  );
}

