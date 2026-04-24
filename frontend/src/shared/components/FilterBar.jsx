function FilterBar({ filters, organizerOptions, onFilterChange }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Tên sự kiện */}
        <div>
          <label
            className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1"
            htmlFor="event-name-filter"
          >
            Tên sự kiện
          </label>
          <input
            className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm px-3 py-2"
            id="event-name-filter"
            placeholder="Nhập tên sự kiện..."
            type="text"
            value={filters.name}
            onChange={(event) => onFilterChange('name', event.target.value)}
          />
        </div>

        {/* Ban tổ chức */}
        <div>
          <label
            className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1"
            htmlFor="organizer-filter"
          >
            Ban tổ chức
          </label>
          <select
            className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm px-3 py-2"
            id="organizer-filter"
            value={filters.organizer}
            onChange={(event) => onFilterChange('organizer', event.target.value)}
          >
            <option value="">Tất cả ban tổ chức</option>
            {organizerOptions.map((organizer) => (
              <option key={organizer} value={organizer}>
                {organizer}
              </option>
            ))}
          </select>
        </div>

        {/* Thời gian */}
        <div className="sm:col-span-2 lg:col-span-1">
          <label
            className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1"
            htmlFor="time-filter"
          >
            Thời gian
          </label>
          <input
            className="w-full border border-slate-200 dark:border-slate-800 dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm px-3 py-2"
            id="time-filter"
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange('date', event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

export default FilterBar