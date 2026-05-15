export default function AdminMobileNav({ items, activeFeature, onSelect, onLogout }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-1 py-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
      <div className="grid grid-cols-6 gap-0">
        {items.map((item) => {
          const isActive = activeFeature === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${isActive ? "text-primary font-bold" : "text-slate-400"}`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span className="text-[9px] leading-none text-center line-clamp-1">{item.label}</span>
            </button>
          );
        })}

        <button type="button" onClick={onLogout} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-slate-400 transition-colors">
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="text-[9px] leading-none text-center line-clamp-1">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}

