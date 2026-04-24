import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import EventStats from '../../../shared/components/EventStats'
import FilterBar from '../../../shared/components/FilterBar'
import EventTable from '../../../shared/components/EventTable'
import CreateEventModal from '../../../shared/components/CreateEventModal'
import EventAttendeesModal from '../../../shared/components/EventAttendeesModal'
import { eventApi } from '../../../shared/api/eventApi'
import { qrcodeApi } from '../../../shared/api/qrcodeApi'
import { QRCodeSVG } from 'qrcode.react'

const toComparableText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const toLocalDateInputValue = (dateTime) => {
  const date = new Date(dateTime)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const PAGE_SIZE = 10

const buildQrPayload = (eventId, qrToken) => {
  return JSON.stringify({
    eventId,
    qrData: qrToken,
    // blueToothId: null, // Temporarily disabled: Bluetooth integration is not ready yet.
  })
}

function EventDashboard({
  shouldOpenCreateEventModal = false,
  onCreateEventRequestHandled,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false)
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState(null)
  const [qrEvent, setQrEvent] = useState(null)
  const [currentQrValue, setCurrentQrValue] = useState('')
  const [currentPinCode, setCurrentPinCode] = useState('')
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const qrIntervalRef = useRef(null)
  const [notice, setNotice] = useState({ type: '', message: '' })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [pagination, setPagination] = useState({
    page: 0,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  })
  const [filters, setFilters] = useState({
    name: '',
    organizer: '',
    date: ''
  })
  const qrContainerRef = useRef(null)

  useEffect(() => {
    if (!notice.message) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setNotice({ type: '', message: '' })
    }, 2600)

    return () => window.clearTimeout(timeout)
  }, [notice])

  const loadEvents = useCallback(async (page) => {
    try {
      setLoading(true)
      const data = await eventApi.fetchEvents(page, PAGE_SIZE)
      const now = new Date()

      const eventContent = Array.isArray(data?.content) ? data.content : []

      const formattedEvents = eventContent.map(backendEvent => {
        const startDate = new Date(backendEvent.startTime)
        const endDate = new Date(backendEvent.endTime)
        const dateStr = startDate.toLocaleDateString('vi-VN')
        const timeStr = startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

        let statusKey = 'UPCOMING'
        if (now < startDate) statusKey = 'UPCOMING'
        else if (now >= startDate && now <= endDate) statusKey = 'ONGOING'
        else statusKey = 'ENDED'

        let statusText = 'Chưa bắt đầu'
        let statusClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide'

        if (statusKey === 'UPCOMING') {
          statusText = 'Sắp diễn ra'
          statusClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide'
        } else if (statusKey === 'ONGOING') {
          statusText = 'Đang diễn ra'
          statusClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide'
        } else if (statusKey === 'ENDED' || statusKey === 'DONE') {
          statusText = 'Đã kết thúc'
          statusClass = 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide'
        }

        const isOngoing = statusKey === 'ONGOING'

        return {
          id: backendEvent.id,
          title: backendEvent.title,
          description: backendEvent.description,
          semesterId: backendEvent.semesterId ?? backendEvent.semester?.id,
          criteriaId: backendEvent.criteriaId ?? backendEvent.criteria?.id,
          startTime: backendEvent.startTime,
          endTime: backendEvent.endTime,
          name: backendEvent.title,
          organizer: backendEvent.organizer,
          date: dateStr,
          time: timeStr,
          location: backendEvent.location,
          type: backendEvent.criteriaId ?? backendEvent.criteria?.id ?? '--',
          status: statusText,
          statusClassName: statusClass,
          disableEdit: isOngoing,
          canGenerateQr: isOngoing,
          rowClassName: isOngoing ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
        }
      })
      setEvents(formattedEvents)
      setPagination({
        page: data.page,
        size: data.size,
        totalElements: data.totalElements,
        totalPages: data.totalPages,
        hasNext: data.hasNext,
        hasPrevious: data.hasPrevious
      })

      if (data.totalPages > 0 && page >= data.totalPages) {
        setCurrentPage(data.totalPages - 1)
      }
    } catch (err) {
      console.error(err)
      setError('Lỗi khi tải dữ liệu sự kiện')
      setEvents([])
      setPagination((prev) => ({
        ...prev,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshCurrentPage = useCallback(() => {
    return loadEvents(currentPage)
  }, [currentPage, loadEvents])

  const handleCreateEvent = () => {
    setEditingEvent(null)
    setIsModalOpen(true)
  }

  const handleEditEvent = (event) => {
    setEditingEvent(event)
    setIsModalOpen(true)
  }

  const handleViewAttendees = (event) => {
    setSelectedEventForAttendees(event)
    setIsAttendeesModalOpen(true)
  }

  const handleOpenQrModal = async (event) => {
    setQrEvent(event)
    setIsGeneratingQr(true)
    setCurrentQrValue('')
    setCurrentPinCode('')
    try {
      const response = await qrcodeApi.generateQr(event.id)
      // const bleId = response.bluetoothId || '' // Temporarily disabled.
      setCurrentQrValue(buildQrPayload(event.id, response.qrToken))
      setCurrentPinCode(response.pinCode || '')

      qrIntervalRef.current = setInterval(async () => {
        try {
          const res = await qrcodeApi.generateQr(event.id)
          setCurrentQrValue(buildQrPayload(event.id, res.qrToken))
          setCurrentPinCode(res.pinCode || '')
        } catch (err) {
          console.error('Failed to update QR code:', err)
          clearInterval(qrIntervalRef.current)
          setCurrentQrValue('')
          setNotice({ type: 'error', message: 'Mất kết nối mạng khi tải mã QR' })
        }
      }, (response.timeToLive || 5) * 1000)
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'Không thể tạo mã QR' })
    } finally {
      setIsGeneratingQr(false)
    }
  }

  const handleCloseQrModal = async () => {
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
    setQrEvent(null)
    setCurrentQrValue('')
    setCurrentPinCode('')
  }

  const qrValue = currentQrValue

  const handleDownloadQr = () => {
    try {
      const svgElement = qrContainerRef.current?.querySelector('svg')
      if (!svgElement || !qrEvent) {
        setNotice({ type: 'error', message: 'Không thể tạo file QR. Vui lòng thử lại.' })
        return
      }

      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      const image = new Image()

      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height

        const context = canvas.getContext('2d')
        if (!context) {
          URL.revokeObjectURL(svgUrl)
          setNotice({ type: 'error', message: 'Không thể xử lý ảnh QR để tải xuống.' })
          return
        }

        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0)
        URL.revokeObjectURL(svgUrl)

        const pngUrl = canvas.toDataURL('image/png')
        const anchor = document.createElement('a')
        anchor.href = pngUrl
        anchor.download = `unipoint-checkin-event-${qrEvent.id}.png`
        anchor.click()

        setNotice({ type: 'success', message: 'Đã tải xuống mã QR thành công.' })
      }

      image.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        setNotice({ type: 'error', message: 'Lỗi khi tạo ảnh QR.' })
      }

      image.src = svgUrl
    } catch {
      setNotice({ type: 'error', message: 'Lỗi khi tải mã QR.' })
    }
  }

  const handlePrintQr = () => {
    const svgElement = qrContainerRef.current?.querySelector('svg')
    if (!svgElement || !qrEvent) {
      setNotice({ type: 'error', message: 'Không thể in mã QR. Vui lòng thử lại.' })
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setNotice({ type: 'error', message: 'Trình duyệt đang chặn cửa sổ in.' })
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Điểm danh - Event ${qrEvent.id}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 24px; text-align: center; }
            .link { margin-top: 12px; font-size: 14px; color: #334155; word-break: break-all; }
          </style>
        </head>
        <body>
          <h2>QR Điểm danh sự kiện</h2>
          <p><strong>${qrEvent.name}</strong></p>
          ${svgElement.outerHTML}
          <div class="link">${qrValue}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()

    setNotice({ type: 'success', message: 'Đã mở cửa sổ in mã QR.' })
  }

  const organizerOptions = useMemo(() => {
    return [...new Set(events.map((event) => event.organizer).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'vi')
    )
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchedName = !filters.name
        || toComparableText(event.name).includes(toComparableText(filters.name))

      const matchedOrganizer = !filters.organizer || event.organizer === filters.organizer

      const matchedDate = !filters.date
        || toLocalDateInputValue(event.startTime) === filters.date

      return matchedName && matchedOrganizer && matchedDate
    })
  }, [events, filters])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handlePageChange = (page) => {
    if (page < 0 || page >= pagination.totalPages || page === currentPage) {
      return
    }
    setCurrentPage(page)
  }

  useEffect(() => {
    loadEvents(currentPage)
  }, [currentPage, loadEvents])

  useEffect(() => {
    if (!shouldOpenCreateEventModal) {
      return
    }

    setEditingEvent(null)
    setIsModalOpen(true)
    if (typeof onCreateEventRequestHandled === 'function') {
      onCreateEventRequestHandled()
    }
  }, [onCreateEventRequestHandled, shouldOpenCreateEventModal])

  const content = (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <EventStats onCreateEvent={handleCreateEvent} />
        <FilterBar
          filters={filters}
          organizerOptions={organizerOptions}
          onFilterChange={handleFilterChange}
        />
        {loading ? (
          <div className="text-center py-10">Đang tải dữ liệu...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : (
          <EventTable
            currentPage={currentPage}
            events={filteredEvents}
            onEdit={handleEditEvent}
            onGenerateQr={handleOpenQrModal}
            onPageChange={handlePageChange}
            onRefresh={refreshCurrentPage}
            onViewAttendees={handleViewAttendees}
            pagination={pagination}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen">
      {notice.message && (
        <div className="fixed right-5 top-5 z-50">
          <div
            className={`rounded-xl px-4 py-3 shadow-lg text-sm font-medium ${notice.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'}`}
          >
            {notice.message}
          </div>
        </div>
      )}

      {content}

      <CreateEventModal
        isOpen={isModalOpen}
        initialEvent={editingEvent}
        onClose={() => {
          setIsModalOpen(false)
          setEditingEvent(null)
        }}
        onSuccess={() => {
          setIsModalOpen(false)
          setEditingEvent(null)
          loadEvents(currentPage)
        }}
      />

      {isAttendeesModalOpen && selectedEventForAttendees && (
        <EventAttendeesModal
          event={selectedEventForAttendees}
          onClose={() => {
            setIsAttendeesModalOpen(false)
            setSelectedEventForAttendees(null)
          }}
        />
      )}

      {qrEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tạo QR Điểm danh</h3>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={handleCloseQrModal}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-slate-200 p-4 dark:border-slate-700 min-h-[320px]" ref={qrContainerRef}>
              {isGeneratingQr ? (
                <div className="flex flex-col items-center text-primary py-10">
                  <span className="material-symbols-outlined text-4xl animate-spin mb-4">sync</span>
                  <span className="text-sm font-medium">Đang khởi tạo mã QR...</span>
                </div>
              ) : currentQrValue ? (
                <>
                  <QRCodeSVG value={currentQrValue} size={280} bgColor="#ffffff" fgColor="#111827" level="H" includeMargin />
                  {currentPinCode && (
                    <div className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-center dark:border-slate-700">
                      <p className="text-xs uppercase tracking-widest text-slate-400">PIN điểm danh</p>
                      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{currentPinCode}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500 py-10">Mã QR đã hết hạn hoặc có lỗi xảy ra.</p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-white font-semibold hover:bg-emerald-700 transition-colors"
                onClick={handleDownloadQr}
              >
                Tải xuống QR
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 transition-colors dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={handlePrintQr}
              >
                In mã QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventDashboard
