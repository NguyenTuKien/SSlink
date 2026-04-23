import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { qrcodeApi } from '../../../shared/api/qrcodeApi'

const SCANNER_REGION_ID = 'unipoint-qr-reader'
const IS_PIN_ONLY = false

function resolveScanPayload(decodedText, fallbackEventId) {
  const raw = String(decodedText || '').trim()
  if (!raw) {
    throw new Error('Mã QR không hợp lệ. Vui lòng quét lại.')
  }

  let qrData = raw
  let eventId = null
  // let blueToothId = null // Temporarily disabled: Bluetooth integration is not ready yet.

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      qrData = parsed.qrData || parsed.qrToken || parsed.token || raw
      if (parsed.eventId != null) {
        eventId = Number(parsed.eventId)
      }
      // blueToothId = parsed.blueToothId || parsed.bluetoothId || null
    }
  } catch {
    // Keep raw text when QR content is not JSON.
  }

  if (eventId == null && /^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const value = Number(url.searchParams.get('eventId'))
      if (Number.isFinite(value) && value > 0) {
        eventId = value
      }
      const tokenFromUrl = url.searchParams.get('qrData') || url.searchParams.get('token')
      if (tokenFromUrl) {
        qrData = tokenFromUrl
      }
    } catch {
      // Ignore URL parse errors.
    }
  }

  if (eventId == null && /^\d+$/.test(raw)) {
    eventId = Number(raw)
  }

  if (eventId == null && fallbackEventId) {
    const fallbackNumber = Number(fallbackEventId)
    if (Number.isFinite(fallbackNumber) && fallbackNumber > 0) {
      eventId = fallbackNumber
    }
  }

  if (eventId == null || !Number.isFinite(eventId) || eventId <= 0) {
    throw new Error('Không đọc được eventId từ mã QR.')
  }

  return { qrData, eventId }
  // return { qrData, eventId, blueToothId }
}

const handleCheckinSubmit = async ({ qrData, eventId }) => {
  const response = await qrcodeApi.scanQRCode({
    qrData,
    eventId,
    // blueToothId, // Temporarily disabled: Bluetooth integration is not ready yet.
  })
  return {
    success: true,
    message: response.message || 'Điểm danh thành công'
  }
}

function QRScanner({ onNavigate }) {
  // QR Scanner States
  const [permissionStatus, setPermissionStatus] = useState('idle')
  const [isScanning, setIsScanning] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [notice, setNotice] = useState({ type: '', message: '' })
  const [toastMessage, setToastMessage] = useState('')
  const [scanCompleted, setScanCompleted] = useState(false)
  const [pinDigits, setPinDigits] = useState(() => Array(6).fill(''))
  const toastTimerRef = useRef(null)
  const redirectTimerRef = useRef(null)
  const pinInputRefs = useRef([])

  const navigate = useNavigate()

  const scannerRef = useRef(null)
  const scanLockRef = useRef(false)
  const fallbackEventId = ''

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop()
      } catch {
        // Ignore stop errors.
      }
    }

    if (scannerRef.current) {
      try {
        scannerRef.current.clear()
      } catch {
        // Ignore clear errors
      }
      scannerRef.current = null
    }

    setIsScanning(false)
  }, [])

  const handleCheckinSuccess = useCallback((message) => {
    setNotice({ type: 'success', message })
    setToastMessage('Điểm danh thành công')
    setScanCompleted(true)

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 3500)

    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
    }
    redirectTimerRef.current = setTimeout(() => {
      if (typeof onNavigate === 'function') {
        onNavigate('dashboard')
        return
      }
      navigate('/student', { replace: true })
    }, 1400)
  }, [navigate, onNavigate])

  const handleCheckinError = useCallback((error) => {
    setNotice({ type: 'error', message: error?.message || 'Mã không hợp lệ hoặc đã hết hạn.' })
    scanLockRef.current = false
  }, [])

  const processCheckin = useCallback(async (scanPayload) => {
    setIsProcessing(true)
    setNotice({ type: '', message: '' })

    try {
      const result = await handleCheckinSubmit(scanPayload)
      handleCheckinSuccess(result.message)
    } catch (error) {
      handleCheckinError(error)
    } finally {
      setIsProcessing(false)
    }
  }, [handleCheckinError, handleCheckinSuccess])

  const onScanSuccess = useCallback(async (decodedText) => {
    if (scanLockRef.current || isProcessing || scanCompleted) {
      return
    }

    scanLockRef.current = true
    await stopScanner()

    try {
      const payload = resolveScanPayload(decodedText, fallbackEventId)
      // BLE confirmation flow is intentionally commented out for now.
      // if (payload.blueToothId) { ... }
      await processCheckin({ ...payload })
      scanLockRef.current = false
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'Mã QR không hợp lệ hoặc đã hết hạn.' })
      scanLockRef.current = false
    }
  }, [fallbackEventId, isProcessing, processCheckin, scanCompleted, stopScanner])

  const startScanner = useCallback(async () => {
    try {
      setNotice({ type: '', message: '' })
      const scanner = new Html5Qrcode(SCANNER_REGION_ID)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          aspectRatio: 1,
        },
        onScanSuccess,
        () => undefined,
      )

      setIsScanning(true)
      setPermissionStatus('granted')
    } catch {
      setPermissionStatus('denied')
      setNotice({
        type: 'error',
        message: 'Không mở được camera. Vui lòng cấp quyền camera và thử lại.',
      })
    }
  }, [onScanSuccess])

  const requestCameraAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })

      stream.getTracks().forEach((track) => track.stop())
      setPermissionStatus('granted')
      await startScanner()
    } catch {
      setPermissionStatus('denied')
      setNotice({
        type: 'error',
        message: 'Bạn chưa cấp quyền camera. Hãy bật quyền trong trình duyệt.',
      })
    }
  }, [startScanner])

  useEffect(() => () => {
    stopScanner()
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
    }
  }, [stopScanner])

  const resetPinInputs = useCallback(() => {
    setPinDigits(Array(6).fill(''))
    pinInputRefs.current[0]?.focus()
  }, [])

  const handlePinSubmit = useCallback(async () => {
    const pinCode = pinDigits.join('')
    if (pinCode.length < 6) {
      setNotice({ type: 'error', message: 'Mã PIN phải đủ 6 chữ số.' })
      return
    }

    setIsProcessing(true)
    setNotice({ type: '', message: '' })

    try {
      await stopScanner()
      const response = await qrcodeApi.checkinByCode({ pinCode })
      handleCheckinSuccess(response.message || 'Điểm danh thành công')
    } catch (error) {
      handleCheckinError(error)
      resetPinInputs()
    } finally {
      setIsProcessing(false)
    }
  }, [handleCheckinError, handleCheckinSuccess, pinDigits, resetPinInputs, stopScanner])

  const handleResetQRTab = async () => {
    setPinDigits(Array(6).fill(''))
    setScanCompleted(false)
    setNotice({ type: '', message: '' })
    scanLockRef.current = false
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
    }
    if (permissionStatus === 'granted') {
      await startScanner()
    }
  }

  const updatePinDigits = (index, value) => {
    const nextDigits = [...pinDigits]
    nextDigits[index] = value
    setPinDigits(nextDigits)
  }

  const handlePinInputChange = (index, rawValue) => {
    const cleaned = rawValue.replace(/\D/g, '')
    if (!cleaned) {
      updatePinDigits(index, '')
      return
    }

    if (cleaned.length === 1) {
      updatePinDigits(index, cleaned)
      if (index < 5) {
        pinInputRefs.current[index + 1]?.focus()
      }
      return
    }

    const chars = cleaned.split('')
    const nextDigits = [...pinDigits]
    let cursor = index
    chars.forEach((char) => {
      if (cursor <= 5) {
        nextDigits[cursor] = char
        cursor += 1
      }
    })
    setPinDigits(nextDigits)
    if (cursor <= 5) {
      pinInputRefs.current[cursor]?.focus()
    }
  }

  const handlePinInputKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus()
    }
  }

  useEffect(() => {
    const pinCode = pinDigits.join('')
    if (pinCode.length === 6 && !isProcessing && !scanCompleted) {
      handlePinSubmit()
    }
  }, [handlePinSubmit, isProcessing, pinDigits, scanCompleted])

  return (
    <div className="relative flex flex-col text-slate-900 dark:text-slate-100 font-display">
      {toastMessage && (
        <div className="fixed left-3 right-3 top-3 z-[60] flex items-center gap-3 rounded-lg bg-green-600 px-4 py-3 text-white shadow-lg shadow-green-600/30 sm:left-auto sm:right-4 sm:top-4">
          <span className="material-symbols-outlined">celebration</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-primary/10 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 md:p-10">
              <div className="flex flex-col items-center max-w-md mx-auto animate-fade-in" id="tab-qr">
                <h3 className="mb-2 text-center text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl">Nhập mã PIN điểm danh</h3>
                <p className="mb-6 text-center text-sm text-slate-500 sm:mb-8">Nhập đúng mã PIN 6 chữ số được cung cấp bởi ban tổ chức.</p>

                {scanCompleted && notice.type === 'success' && (
                  <div className="w-full mb-6 p-5 rounded-2xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-green-600 text-3xl">task_alt</span>
                      <div className="flex-1">
                        <p className="text-base font-bold text-green-800 dark:text-green-300">Điểm danh thành công</p>
                        <p className="text-sm mt-1 text-green-700 dark:text-green-400">{notice.message}</p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => {
                              if (typeof onNavigate === 'function') {
                                onNavigate('dashboard')
                                return
                              }
                              navigate('/student', { replace: true })
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold sm:w-auto"
                          >
                            Quay lại Dashboard
                          </button>
                          <button
                            onClick={handleResetQRTab}
                            className="w-full bg-white text-green-700 border border-green-300 px-4 py-2 rounded-lg text-sm font-semibold sm:w-auto"
                          >
                            Quét lại
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!IS_PIN_ONLY && (
                  <div className="w-full aspect-square bg-slate-100 dark:bg-slate-900 rounded-2xl relative flex items-center justify-center overflow-hidden border-2 border-dashed border-primary/30 group">
                    <div
                      id={SCANNER_REGION_ID}
                      className={`absolute inset-0 z-0 [&>div]:!h-full [&>div]:!w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover ${isScanning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    />

                    {!isScanning && !scanCompleted && (
                      <>
                        <div
                          className="absolute inset-0 bg-cover bg-center opacity-50 transition-transform group-hover:scale-110"
                          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80')" }}
                        />
                        <div className="relative z-10 size-48 border-2 border-primary rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-sm">
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                          <span className="material-symbols-outlined text-primary text-6xl opacity-70">qr_code_2</span>
                        </div>

                        <div className="absolute bottom-4 left-0 right-0 text-center z-10">
                          <button
                            onClick={requestCameraAccess}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg transition-all"
                          >
                            Bắt đầu quét
                          </button>
                        </div>
                      </>
                    )}

                    {isScanning && !isProcessing && (
                      <div className="absolute top-4 right-4 z-20">
                        <button onClick={stopScanner} className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur transition-all flex items-center justify-center">
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                      </div>
                    )}

                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none z-10">
                        <div className="w-full h-full p-8 flex items-center justify-center relative">
                          <div className="w-full max-w-[240px] aspect-square relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary/80"></div>
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary/80"></div>
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary/80"></div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary/80"></div>
                            {isProcessing && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm">
                                <span className="material-symbols-outlined animate-spin text-white text-4xl">sync</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {notice.message && notice.type === 'error' && (
                  <div className={`w-full mt-4 p-4 border rounded-lg flex items-start gap-3 ${notice.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <span className={`material-symbols-outlined shrink-0 mt-0.5 ${notice.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {notice.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${notice.type === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                        {notice.type === 'success' ? 'Thành công!' : 'Lỗi!'}
                      </p>
                      <p className={`text-xs mt-1 ${notice.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {notice.message}
                      </p>
                    </div>
                    <button
                      onClick={handleResetQRTab}
                      className={notice.type === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                    </button>
                  </div>
                )}

                {!scanCompleted && !isScanning && !notice.message && (
                  <div className="w-full mt-10">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nhập mã PIN</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        {pinDigits.map((digit, index) => (
                          <input
                            key={index}
                            type="text"
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={1}
                            ref={(el) => {
                              pinInputRefs.current[index] = el
                            }}
                            className="h-11 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-base font-bold outline-none transition-all focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 sm:h-12 sm:w-12 sm:text-lg"
                            value={digit}
                            onChange={(e) => handlePinInputChange(index, e.target.value)}
                            onKeyDown={(e) => handlePinInputKeyDown(index, e)}
                            disabled={isProcessing}
                          />
                        ))}
                      </div>
                      <button
                        className="bg-primary/10 text-primary px-6 py-3 rounded-lg font-bold text-sm hover:bg-primary/20 transition-all disabled:opacity-50"
                        onClick={handlePinSubmit}
                        disabled={isProcessing}
                      >
                        Xác nhận
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRScanner
