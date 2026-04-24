function EventStats({ onCreateEvent }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Danh sách sự kiện</h2>
        <p className="text-slate-500 mt-1 text-sm sm:text-base">
          Quản lý và theo dõi các hoạt động sự kiện sắp tới.
        </p>
      </div>

      <button
        className="w-full sm:w-auto flex-shrink-0 bg-[#d23232] hover:bg-[#d23232]/90 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#d23232]/20"
        onClick={onCreateEvent}
      >
        <span className="material-symbols-outlined">add_circle</span>
        Tạo sự kiện mới
      </button>
    </div>
  )
}

export default EventStats