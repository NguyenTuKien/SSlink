import Pagination from '../../components/Pagination'
import { eventApi } from '../api/eventApi'

function EventTable({ events, onRefresh, onEdit, onGenerateQr, onViewAttendees, pagination, currentPage, onPageChange }) {
  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      try {
        await eventApi.deleteEvent(id)
        if (onRefresh) onRefresh()
      } catch (err) {
        console.error(err)
        alert('Lỗi khi xóa sự kiện')
      }
    }
  }

  const ActionButtons = ({ event }) => (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Xem danh sách sinh viên */}
      <button
        className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
        title="Xem sinh viên đã check-in"
        onClick={() => onViewAttendees && onViewAttendees(event)}
        type="button"
      >
        <span className="material-symbols-outlined text-xl">visibility</span>
      </button>

      {/* Sửa */}
      {event.disableEdit ? (
        <button
          className="p-2 text-slate-300 dark:text-slate-700 cursor-not-allowed"
          disabled
          title="Không thể sửa khi đang diễn ra"
        >
          <span className="material-symbols-outlined text-xl">edit_off</span>
        </button>
      ) : (
        <button
          className="p-2 text-slate-400 hover:text-primary transition-colors"
          title="Sửa"
          onClick={() => onEdit && onEdit(event)}
        >
          <span className="material-symbols-outlined text-xl">edit</span>
        </button>
      )}

      {/* Xóa */}
      <button
        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
        title="Xóa"
        onClick={() => handleDelete(event.id)}
      >
        <span className="material-symbols-outlined text-xl">delete</span>
      </button>

      {/* QR */}
      {event.canGenerateQr ? (
        <button
          className="inline-flex items-center gap-1 px-2 py-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-semibold"
          title="Tạo QR Điểm danh"
          onClick={() => onGenerateQr && onGenerateQr(event)}
          type="button"
        >
          <span className="material-symbols-outlined text-base">qr_code_2</span>
          <span className="hidden sm:inline">Tạo QR</span>
        </button>
      ) : (
        <button
          className="inline-flex items-center gap-1 px-2 py-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed rounded-lg text-xs font-semibold"
          title="Chỉ bật khi sự kiện đang diễn ra"
          disabled
          type="button"
        >
          <span className="material-symbols-outlined text-base">qr_code_2</span>
          <span className="hidden sm:inline">Tạo QR</span>
        </button>
      )}
    </div>
  )

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

      {/* ── MOBILE: Card layout (< md) ── */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {events.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            Không có sự kiện phù hợp.
          </div>
        ) : events.map((event) => (
          <div
            key={event.id}
            className={`p-4 ${event.rowClassName || ''}`}
          >
            {/* Row 1: Name + Status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{event.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">ID: {event.id}</div>
              </div>
              <span className={event.statusClassName + ' flex-shrink-0'}>{event.status}</span>
            </div>

            {/* Row 2: Meta info */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">group</span>
                <span className="truncate">{event.organizer || '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span>{event.date} {event.time}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">location_on</span>
                <span className="truncate">{event.location || '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">category</span>
                <span className="truncate">{event.type}</span>
              </div>
            </div>

            {/* Row 3: Actions */}
            <div className="flex items-center border-t border-slate-100 dark:border-slate-800 pt-2 -mx-1">
              <ActionButtons event={event} />
            </div>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: Table layout (≥ md) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Tên sự kiện</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Ban tổ chức</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Thời gian</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Địa điểm</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Loại</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {events.length === 0 ? (
              <tr>
                <td className="px-6 py-10 text-center text-slate-500" colSpan={7}>
                  Không có sự kiện phù hợp.
                </td>
              </tr>
            ) : events.map((event) => (
              <tr
                className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${event.rowClassName}`}
                key={event.id}
              >
                <td className="px-6 py-5">
                  <div className="font-semibold">{event.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">ID: {event.id}</div>
                </td>
                <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400 font-medium">{event.organizer}</td>
                <td className="px-6 py-5 text-sm">
                  <div className="font-medium text-slate-700 dark:text-slate-200">{event.date}</div>
                  <div className="text-xs text-slate-400">{event.time}</div>
                </td>
                <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400">{event.location}</td>
                <td className="px-6 py-5">
                  <span className="bg-[#d23232]/10 text-[#d23232] text-xs font-bold px-2 py-1 rounded">
                    {event.type}
                  </span>
                </td>
                <td className="px-6 py-5 text-center">
                  <span className={event.statusClassName}>{event.status}</span>
                </td>
                <td className="px-6 py-5 text-right">
                  <ActionButtons event={event} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        onPageChange={onPageChange}
        pageSize={pagination.size}
        totalElements={pagination.totalElements}
        totalPages={pagination.totalPages}
      />
    </div>
  )
}

export default EventTable