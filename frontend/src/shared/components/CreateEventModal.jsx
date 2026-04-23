import { useState, useEffect, useMemo, useRef } from 'react'
import { eventApi } from '../api/eventApi'
import { criteriaApi } from '../api/criteriaApi'
import { semesterApi } from '../api/semesterApi'
import { useAuth } from '../../context/AuthContext'
import { apiRequest } from '../api/http'

const CLASS_MEETING_CRITERIA_LABEL = '2.4. Họp lớp'

const toDateTimeLocal = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const formatDateVi = (date) => {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const isClassMeetingCriteria = (criteria) => {
  if (!criteria) return false
  const code = String(criteria.code || '').trim()
  const name = String(criteria.name || '').trim()
  return name === CLASS_MEETING_CRITERIA_LABEL || (code === '2.4' && name === 'Họp lớp') || name === 'Họp lớp'
}

const toClassOption = (item) => {
  const classCode = String(item?.classCode || '').trim()
  const className = String(item?.className || item?.name || '').trim()
  if (!classCode) return null
  return {
    value: classCode,
    label: className ? `${classCode} - ${className}` : classCode,
    className: className || classCode,
  }
}

const resolveLecturerId = (user) => user?.backendUserId || user?.userId || user?.profileCode || ''

function CreateEventModal({ isOpen, onClose, onSuccess, initialEvent = null }) {
  const isEditMode = Boolean(initialEvent?.id)
  const { user } = useAuth()
  const wasClassMeetingRef = useRef(false)

  const [formData, setFormData] = useState({
    title: '',
    organizer: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    semesterId: '',
    criteriaId: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [criterias, setCriterias] = useState([])
  const [semesters, setSemesters] = useState([])
  const [lecturerClasses, setLecturerClasses] = useState([])
  const [classOptionsError, setClassOptionsError] = useState('')

  const selectedCriteria = useMemo(
    () => criterias.find((criteria) => String(criteria.id) === String(formData.criteriaId)),
    [criterias, formData.criteriaId],
  )
  const isClassMeeting = useMemo(() => isClassMeetingCriteria(selectedCriteria), [selectedCriteria])
  const classMeetingOptions = useMemo(
    () => lecturerClasses.map(toClassOption).filter(Boolean),
    [lecturerClasses],
  )
  const classOptionByCode = useMemo(
    () => Object.fromEntries(classMeetingOptions.map((item) => [item.value, item])),
    [classMeetingOptions],
  )

  const resolvedClassCode = user?.classCode || ''
  const resolvedClassName = user?.className || resolvedClassCode || ''

  const resetForm = () => {
    setFormData({
      title: '',
      organizer: '',
      description: '',
      startTime: '',
      endTime: '',
      location: '',
      semesterId: '',
      criteriaId: ''
    })
    setError('')
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        setError('')

        const [criteriaPayload, semesterPayload] = await Promise.all([
          criteriaApi.fetchCriterias(),
          semesterApi.fetchSemesters()
        ])
        const criteriaData = Array.isArray(criteriaPayload) ? criteriaPayload : []
        const semesterData = Array.isArray(semesterPayload) ? semesterPayload : []

        setCriterias(criteriaData);
        setSemesters(semesterData);

        const lecturerId = resolveLecturerId(user)
        if (lecturerId) {
          try {
            const classRes = await apiRequest(`/lecturer/students/options?lecturerId=${encodeURIComponent(lecturerId)}`)
            const rawClassPayload = classRes?.data || classRes
            const classData = Array.isArray(rawClassPayload?.classes) ? rawClassPayload.classes : []
            setLecturerClasses(classData)
            setClassOptionsError('')
          } catch (classErr) {
            console.error('Failed to load lecturer classes:', classErr)
            setLecturerClasses([])
            setClassOptionsError('Không tải được danh sách lớp phụ trách.')
          }
        } else {
          setLecturerClasses([])
          setClassOptionsError('')
        }

        if (isEditMode) {
          setFormData({
            title: initialEvent?.title || '',
            organizer: initialEvent?.organizer || '',
            description: initialEvent?.description || '',
            startTime: toDateTimeLocal(initialEvent?.startTime),
            endTime: toDateTimeLocal(initialEvent?.endTime),
            location: initialEvent?.location || '',
            semesterId: initialEvent?.semesterId ? String(initialEvent.semesterId) : (semesterData[0] ? String(semesterData[0].id) : ''),
            criteriaId: initialEvent?.criteriaId ? String(initialEvent.criteriaId) : (criteriaData[0] ? String(criteriaData[0].id) : '')
          })
        } else {
          setFormData(prev => ({
            ...prev,
            criteriaId: criteriaData.length > 0 ? String(criteriaData[0].id) : '',
            semesterId: semesterData.length > 0 ? String(semesterData[0].id) : ''
          }));
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('Không tải được dữ liệu học kỳ/tiêu chí.');
      }
    };
    if (isOpen) {
      loadData();
    } else {
      resetForm()
    }
  }, [initialEvent, isEditMode, isOpen, user]);

  useEffect(() => {
    if (!isOpen || isEditMode) {
      wasClassMeetingRef.current = false
      return
    }

    if (isClassMeeting) {
      const now = new Date()
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
      const todayLabel = formatDateVi(now)

      setFormData((prev) => ({
        ...prev,
        organizer:
          classOptionByCode[prev.organizer]?.value
          || classOptionByCode[resolvedClassCode]?.value
          || classMeetingOptions[0]?.value
          || resolvedClassCode,
        title: `Họp lớp ${
          classOptionByCode[prev.organizer]?.className
          || classOptionByCode[resolvedClassCode]?.className
          || classMeetingOptions[0]?.className
          || resolvedClassName
          || 'chưa rõ lớp'
        } ngày ${todayLabel}`,
        startTime: toDateTimeLocal(now),
        endTime: toDateTimeLocal(oneHourLater),
      }))
    } else if (wasClassMeetingRef.current) {
      setFormData((prev) => ({
        ...prev,
        organizer: '',
        title: '',
        startTime: '',
        endTime: '',
      }))
    }

    wasClassMeetingRef.current = isClassMeeting
  }, [isClassMeeting, isEditMode, isOpen, resolvedClassCode, resolvedClassName, classMeetingOptions, classOptionByCode])

  useEffect(() => {
    if (!isOpen || isEditMode || !isClassMeeting || !formData.organizer) {
      return
    }

    const selectedClass = classOptionByCode[formData.organizer]
    if (!selectedClass) {
      return
    }

    const now = new Date()
    const todayLabel = formatDateVi(now)
    const nextTitle = `Họp lớp ${selectedClass.className} ngày ${todayLabel}`
    if (formData.title !== nextTitle) {
      setFormData((prev) => ({ ...prev, title: nextTitle }))
    }
  }, [classOptionByCode, formData.organizer, formData.title, isClassMeeting, isEditMode, isOpen])

  if (!isOpen) {
    return null
  }

  const isClassMeetingOrganizerInvalid = isClassMeeting && (!formData.organizer || classMeetingOptions.length === 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim() || !formData.location.trim()) {
      setError('Vui lòng nhập đầy đủ tên sự kiện và địa điểm.')
      return
    }

    if (!formData.semesterId || !formData.criteriaId) {
      setError('Vui lòng chọn học kỳ và tiêu chí đánh giá.')
      return
    }

    if (!formData.startTime || !formData.endTime) {
      setError('Vui lòng nhập thời gian bắt đầu và kết thúc.')
      return
    }

    if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.')
      return
    }

    if (isClassMeetingOrganizerInvalid) {
      setError('Vui lòng chọn lớp phụ trách cho sự kiện họp lớp.')
      return
    }

    const payload = {
      title: formData.title.trim(),
      organizer: formData.organizer || null,
      description: formData.description.trim() || null,
      location: formData.location.trim(),
      semesterId: Number(formData.semesterId),
      criteriaId: Number(formData.criteriaId),
      startTime: formData.startTime,
      endTime: formData.endTime,
    }

    try {
      setLoading(true)
      if (isEditMode) {
        await eventApi.updateEvent(initialEvent.id, payload)
      } else {
        await eventApi.createEvent(payload)
      }
      if (onSuccess) onSuccess()
      resetForm()
    } catch (err) {
      console.error(err)
      setError(err.message || (isEditMode ? 'Lỗi khi cập nhật sự kiện' : 'Lỗi khi tạo sự kiện'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { id, value } = e.target
    const fieldMap = {
      'event-name': 'title',
      'event-organizer': 'organizer',
      'event-criteria': 'criteriaId',
      'event-semester': 'semesterId',
      'event-description': 'description',
      'event-start-time': 'startTime',
      'event-end-time': 'endTime',
      'event-location': 'location'
    }
    const field = fieldMap[id]
    if (field) {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh] md:max-h-[85vh]">
        {/* Header */}
        <div className="px-4 md:px-8 py-3 md:py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold">{isEditMode ? 'Cập nhật sự kiện' : 'Tạo sự kiện mới'}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEditMode ? 'Chỉnh sửa thông tin sự kiện.' : 'Điền các thông tin cần thiết bên dưới.'}
            </p>
          </div>
          <button
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"
            onClick={handleClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="create-event-form" className="px-4 md:px-8 py-3 md:py-6" onSubmit={handleSubmit}>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 mb-6">
                {error}
              </div>
            )}

            {/* Desktop: 2 columns side by side | Mobile: single column */}
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 gap-y-3 md:gap-y-5">

              {/* ── LEFT COLUMN ── */}
              <div className="flex flex-col gap-3 md:gap-5">
                {/* Tên sự kiện */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-name"
                  >
                    Tên sự kiện <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed transition"
                    id="event-name"
                    placeholder="Ví dụ: Hội thảo Phát triển Kỹ năng số"
                    type="text"
                    value={formData.title}
                    onChange={handleChange}
                    disabled={isClassMeeting}
                  />
                </div>

                {/* Tiêu chí đánh giá */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-criteria"
                  >
                    Tiêu chí đánh giá <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 transition"
                    id="event-criteria"
                    value={formData.criteriaId}
                    onChange={handleChange}
                  >
                    <option value="">Chọn tiêu chí</option>
                    {criterias.map(criteria => (
                      <option key={criteria.id} value={criteria.id}>{criteria.code} - {criteria.name}</option>
                    ))}
                  </select>
                </div>

                {/* Mô tả */}
                <div className="flex-1 flex flex-col">
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-description"
                  >
                    Mô tả sự kiện
                  </label>
                  <textarea
                    className="w-full flex-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-4 py-2.5 resize-none transition"
                    id="event-description"
                    placeholder="Mô tả nội dung chính của sự kiện..."
                    rows="3"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div className="flex flex-col gap-3 md:gap-5">
                {/* Ban tổ chức */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-organizer"
                  >
                    Ban tổ chức <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed transition"
                    id="event-organizer"
                    value={formData.organizer}
                    onChange={handleChange}
                    disabled={isClassMeeting && classMeetingOptions.length === 0}
                  >
                    {isClassMeeting ? (
                      <>
                        <option value="">{classMeetingOptions.length ? 'Chọn lớp phụ trách' : 'Chưa có lớp phụ trách'}</option>
                        {classMeetingOptions.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="">Chọn đơn vị tổ chức</option>
                        <option>Khoa CNTT</option>
                        <option>CLB Kỹ năng</option>
                        <option>Phòng Đào tạo</option>
                      </>
                    )}
                  </select>
                  {isClassMeeting && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Ban tổ chức được lấy từ danh sách lớp bạn đang phụ trách.
                    </p>
                  )}
                  {isClassMeeting && classOptionsError && (
                    <p className="mt-1 text-xs text-red-500">{classOptionsError}</p>
                  )}
                  {isClassMeeting && classMeetingOptions.length === 0 && !classOptionsError && (
                    <p className="mt-1 text-xs text-red-500">Bạn chưa có lớp phụ trách để tạo sự kiện họp lớp.</p>
                  )}
                </div>

                {/* Học kỳ */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-semester"
                  >
                    Học kỳ <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 transition"
                    id="event-semester"
                    value={formData.semesterId}
                    onChange={handleChange}
                  >
                    <option value="">Chọn học kỳ</option>
                    {semesters.map(semester => (
                      <option key={semester.id} value={semester.id}>{semester.name}</option>
                    ))}
                  </select>
                </div>

                {/* Thời gian bắt đầu */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-start-time"
                  >
                    Thời gian bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed transition"
                    id="event-start-time"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={handleChange}
                    disabled={isClassMeeting}
                  />
                </div>

                {/* Thời gian kết thúc */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-end-time"
                  >
                    Thời gian kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed transition"
                    id="event-end-time"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={handleChange}
                    disabled={isClassMeeting}
                  />
                </div>

                {/* Địa điểm */}
                <div>
                  <label
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 md:mb-2"
                    htmlFor="event-location"
                  >
                    Địa điểm <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-3 py-2 md:px-4 md:py-2.5 transition"
                    id="event-location"
                    placeholder="Nhập tên phòng hoặc khu vực..."
                    type="text"
                    value={formData.location}
                    onChange={handleChange}
                  />
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-8 py-3 md:py-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button
            className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            onClick={handleClose}
            type="button"
          >
            Hủy bỏ
          </button>
          <button
            className="bg-[#d23232] hover:bg-[#d23232]/90 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg shadow-[#d23232]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            form="create-event-form"
            type="submit"
            disabled={loading || isClassMeetingOrganizerInvalid}
          >
            {loading ? 'Đang lưu...' : (isEditMode ? 'Cập nhật' : 'Lưu sự kiện')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateEventModal
