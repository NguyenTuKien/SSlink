import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { apiRequest } from "../../../shared/api/http";
import {
  closeFaceAttendanceSession,
  confirmFaceAttendance,
  createFaceAttendanceSession,
  recognizeFaceAttendanceFrame,
} from "../../../api/faceApi";

const TXT = {
  openCameraError: "Kh\u00f4ng m\u1edf \u0111\u01b0\u1ee3c camera. Vui l\u00f2ng c\u1ea5p quy\u1ec1n camera v\u00e0 th\u1eed l\u1ea1i.",
  selectClassEventSemester: "Vui l\u00f2ng ch\u1ecdn l\u1edbp, s\u1ef1 ki\u1ec7n v\u00e0 h\u1ecdc k\u1ef3.",
  sessionCreated: "\u0110\u00e3 t\u1ea1o phi\u00ean \u0111i\u1ec3m danh khu\u00f4n m\u1eb7t.",
  cameraNotReady: "Camera ch\u01b0a s\u1eb5n s\u00e0ng.",
  captureFrameError: "Kh\u00f4ng ch\u1ee5p \u0111\u01b0\u1ee3c khung h\u00ecnh.",
  sessionNotFound: "Ch\u01b0a c\u00f3 phi\u00ean \u0111i\u1ec3m danh.",
  frameScanned: "\u0110\u00e3 qu\u00e9t khung h\u00ecnh.",
  noStudentSelected: "Ch\u01b0a c\u00f3 sinh vi\u00ean n\u00e0o \u0111\u01b0\u1ee3c ch\u1ecdn.",
  attendanceConfirmed: "\u0110\u00e3 x\u00e1c nh\u1eadn \u0111i\u1ec3m danh.",
  sessionClosed: "\u0110\u00e3 \u0111\u00f3ng phi\u00ean \u0111i\u1ec3m danh.",
  classLabel: "L\u1edbp",
  selectClass: "Ch\u1ecdn l\u1edbp",
  eventLabel: "S\u1ef1 ki\u1ec7n",
  selectEvent: "Ch\u1ecdn s\u1ef1 ki\u1ec7n",
  semesterLabel: "H\u1ecdc k\u1ef3",
  selectSemester: "Ch\u1ecdn h\u1ecdc k\u1ef3",
  createSession: "T\u1ea1o phi\u00ean",
  detected: "Ph\u00e1t hi\u1ec7n",
  newMatches: "Kh\u1edbp m\u1edbi",
  lastScan: "L\u1ea7n qu\u00e9t cu\u1ed1i",
  turnOffCamera: "T\u1eaft camera",
  turnOnCamera: "M\u1edf camera",
  stopAutoScan: "D\u1eebng qu\u00e9t t\u1ef1 \u0111\u1ed9ng",
  autoScan: "Qu\u00e9t t\u1ef1 \u0111\u1ed9ng",
  scanFrame: "Qu\u00e9t khung h\u00ecnh",
  closeSession: "\u0110\u00f3ng phi\u00ean",
  matchedStudents: "Sinh vi\u00ean \u0111\u00e3 kh\u1edbp",
  noRecognizedResult: "Ch\u01b0a c\u00f3 k\u1ebft qu\u1ea3 nh\u1eadn di\u1ec7n.",
  duplicate: "Tr\u00f9ng l\u1eb7p",
  confirmAttendance: "X\u00e1c nh\u1eadn \u0111i\u1ec3m danh",
  unknownFace: "Chưa rõ",
};

export default function LecturerFaceAttendancePanel() {
  const { user } = useAuth();
  const lecturerId = user?.userId;
  const previewRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const autoScanTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [form, setForm] = useState({ classId: "", eventId: "", semesterId: "" });
  const [session, setSession] = useState(null);
  const [matches, setMatches] = useState([]);
  const [faceBoxes, setFaceBoxes] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [cameraOn, setCameraOn] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [scanSummary, setScanSummary] = useState({
    detectedFaceCount: 0,
    matchedCount: 0,
    lastRecognizedAt: "",
  });
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [lastFrameSize, setLastFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    async function loadOptions() {
      try {
        const [studentOptions, eventPayload, semesterPayload] = await Promise.all([
          lecturerId ? apiRequest(`/lecturer/students/options?lecturerId=${lecturerId}`) : Promise.resolve({ classes: [] }),
          apiRequest("/v1/events?page=0&size=100"),
          apiRequest("/v1/semesters"),
        ]);
        const classItems = Array.isArray(studentOptions?.classes) ? studentOptions.classes : [];
        const eventItems = Array.isArray(eventPayload?.content) ? eventPayload.content : [];
        const semesterItems = Array.isArray(semesterPayload?.data) ? semesterPayload.data : semesterPayload;
        setClasses(classItems);
        setEvents(eventItems);
        setSemesters(Array.isArray(semesterItems) ? semesterItems : []);
        setForm((prev) => ({
          classId: prev.classId || String(classItems[0]?.id || ""),
          eventId: prev.eventId || String(eventItems[0]?.id || ""),
          semesterId: prev.semesterId
            || String(
              (Array.isArray(semesterItems) && semesterItems.find((item) => item.isActive)?.id)
              || semesterItems?.[0]?.id
              || "",
            ),
        }));
      } catch (error) {
        setNotice({ type: "error", message: error.message });
      }
    }

    loadOptions();
  }, [lecturerId]);

  useEffect(() => () => {
    if (autoScanTimerRef.current) {
      window.clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    stopCamera();
  }, []);

  useEffect(() => {
    if (!notice.message) {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      return undefined;
    }

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = window.setTimeout(() => {
      setNotice({ type: "", message: "" });
      noticeTimerRef.current = null;
    }, 3000);

    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
    };
  }, [notice.message]);

  useEffect(() => {
    if (autoScanTimerRef.current) {
      window.clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }

    if (!autoScan || !cameraOn || !session?.id || session?.status !== "OPEN" || processing) {
      return undefined;
    }

    autoScanTimerRef.current = window.setTimeout(() => {
      handleRecognize(true);
    }, 1400);

    return () => {
      if (autoScanTimerRef.current) {
        window.clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [autoScan, cameraOn, session?.id, session?.status, processing]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const updateSize = () => {
      setPreviewSize({
        width: preview.clientWidth || 0,
        height: preview.clientHeight || 0,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const overlayBoxes = useMemo(() => {
    if (!Array.isArray(faceBoxes) || faceBoxes.length === 0) {
      return [];
    }
    if (previewSize.width <= 0 || previewSize.height <= 0 || videoSize.width <= 0 || videoSize.height <= 0) {
      return [];
    }

    const containerWidth = previewSize.width;
    const containerHeight = previewSize.height;
    const videoAspect = videoSize.width / videoSize.height;
    const containerAspect = containerWidth / containerHeight;

    let renderedWidth = containerWidth;
    let renderedHeight = containerHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > videoAspect) {
      renderedHeight = containerHeight;
      renderedWidth = renderedHeight * videoAspect;
      offsetX = (containerWidth - renderedWidth) / 2;
    } else {
      renderedWidth = containerWidth;
      renderedHeight = renderedWidth / videoAspect;
      offsetY = (containerHeight - renderedHeight) / 2;
    }

    return faceBoxes
      .map((item, index) => {
        const clampRatio = (value) => Math.max(0, Math.min(1, value));
        const parseNumber = (...values) => {
          for (const value of values) {
            if (value === null || value === undefined || value === "") continue;
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
          }
          return NaN;
        };

        let xRatio = parseNumber(item?.xRatio, item?.x_ratio);
        let yRatio = parseNumber(item?.yRatio, item?.y_ratio);
        let widthRatio = parseNumber(item?.widthRatio, item?.width_ratio);
        let heightRatio = parseNumber(item?.heightRatio, item?.height_ratio);

        if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio) || !Number.isFinite(widthRatio) || !Number.isFinite(heightRatio)) {
          const boxX = parseNumber(item?.x, item?.left);
          const boxY = parseNumber(item?.y, item?.top);
          const boxWidth = parseNumber(item?.width, item?.w);
          const boxHeight = parseNumber(item?.height, item?.h);
          const frameWidth = parseNumber(item?.frameWidth, item?.frame_width, lastFrameSize.width);
          const frameHeight = parseNumber(item?.frameHeight, item?.frame_height, lastFrameSize.height);
          if (Number.isFinite(boxX) && Number.isFinite(boxY) && Number.isFinite(boxWidth) && Number.isFinite(boxHeight) && frameWidth > 0 && frameHeight > 0) {
            xRatio = boxX / frameWidth;
            yRatio = boxY / frameHeight;
            widthRatio = boxWidth / frameWidth;
            heightRatio = boxHeight / frameHeight;
          }
        }

        if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio) || !Number.isFinite(widthRatio) || !Number.isFinite(heightRatio)) {
          return null;
        }

        const left = offsetX + clampRatio(xRatio) * renderedWidth;
        const top = offsetY + clampRatio(yRatio) * renderedHeight;
        const width = Math.max(1, clampRatio(widthRatio) * renderedWidth);
        const height = Math.max(1, clampRatio(heightRatio) * renderedHeight);

        return {
          id: item?.probeFaceId || item?.probe_face_id || `box-${index}`,
          left,
          top,
          width,
          height,
          label: item?.fullName || item?.full_name || item?.studentName || TXT.unknownFace,
          confidence: Number(item?.confidence || 0),
          result: item?.result || item?.match_result || "",
        };
      })
      .filter(Boolean);
  }, [faceBoxes, lastFrameSize.height, lastFrameSize.width, previewSize.height, previewSize.width, videoSize.height, videoSize.width]);

  function handleVideoLoadedMetadata() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setVideoSize({
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
    });
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setNotice({ type: "", message: "" });
    } catch {
      setNotice({ type: "error", message: TXT.openCameraError });
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setAutoScan(false);
    setCameraOn(false);
    setVideoSize({ width: 0, height: 0 });
    setLastFrameSize({ width: 0, height: 0 });
    setFaceBoxes([]);
  }

  async function handleCreateSession() {
    if (!form.classId || !form.eventId || !form.semesterId) {
      setNotice({ type: "error", message: TXT.selectClassEventSemester });
      return;
    }
    setProcessing(true);
    try {
      const payload = await createFaceAttendanceSession({
        classId: Number(form.classId),
        eventId: Number(form.eventId),
        semesterId: Number(form.semesterId),
      });
      setSession(payload);
      setMatches([]);
      setFaceBoxes([]);
      setSelectedIds(new Set());
      setScanSummary({ detectedFaceCount: 0, matchedCount: 0, lastRecognizedAt: "" });
      await startCamera();
      setAutoScan(true);
      setNotice({ type: "success", message: TXT.sessionCreated });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setProcessing(false);
    }
  }

  async function captureFrameBlob() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      throw new Error(TXT.cameraNotReady);
    }

    const maxWidth = 1280;
    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    setLastFrameSize({ width, height });
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error(TXT.captureFrameError));
          return;
        }
        resolve(new File([blob], "face-frame.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.78);
    });
  }

  function mergeMatches(existing, incoming) {
    const merged = new Map(existing.map((item) => [item.studentId, item]));
    incoming.forEach((item) => {
      const current = merged.get(item.studentId);
      if (!current) {
        merged.set(item.studentId, item);
        return;
      }
      if ((item.confidence || 0) > (current.confidence || 0) || (current.duplicate && !item.duplicate)) {
        merged.set(item.studentId, { ...current, ...item });
      }
    });
    return Array.from(merged.values()).sort((left, right) => (right.confidence || 0) - (left.confidence || 0));
  }

  async function handleRecognize(silent = false) {
    if (!session?.id) {
      setNotice({ type: "error", message: TXT.sessionNotFound });
      return;
    }
    setProcessing(true);
    try {
      const frameFile = await captureFrameBlob();
      const payload = await recognizeFaceAttendanceFrame(session.id, frameFile);
      setMatches((prev) => mergeMatches(prev, payload?.matches || []));
      const incomingFaceBoxes = Array.isArray(payload?.faceBoxes)
        ? payload.faceBoxes
        : (Array.isArray(payload?.face_boxes) ? payload.face_boxes : []);
      setFaceBoxes(incomingFaceBoxes);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        (payload?.matches || []).forEach((match) => {
          if (!match.duplicate) {
            next.add(match.studentId);
          }
        });
        return next;
      });
      setScanSummary({
        detectedFaceCount: Number(payload?.detectedFaceCount ?? payload?.detected_face_count ?? 0),
        matchedCount: Array.isArray(payload?.matches) ? payload.matches.length : 0,
        lastRecognizedAt: new Date().toLocaleTimeString("vi-VN"),
      });
      if (!silent) {
        setNotice({ type: "success", message: payload?.message || TXT.frameScanned });
      }
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirm() {
    if (confirming || !session?.id || selectedIds.size === 0) {
      setNotice({ type: "error", message: TXT.noStudentSelected });
      return;
    }
    setConfirming(true);
    try {
      const payload = await confirmFaceAttendance(session.id, Array.from(selectedIds));
      setNotice({ type: "success", message: payload?.message || TXT.attendanceConfirmed });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setConfirming(false);
    }
  }

  async function handleClose() {
    if (!session?.id) {
      return;
    }
    setProcessing(true);
    try {
      const payload = await closeFaceAttendanceSession(session.id);
      setSession(payload);
      stopCamera();
      setNotice({ type: "success", message: payload?.message || TXT.sessionClosed });
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setProcessing(false);
    }
  }

  function toggleSelected(studentId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <label className="flex-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{TXT.classLabel}</span>
            <select value={form.classId} onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{TXT.selectClass}</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.classCode || item.name || item.id}</option>)}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{TXT.eventLabel}</span>
            <select value={form.eventId} onChange={(event) => setForm((prev) => ({ ...prev, eventId: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{TXT.selectEvent}</option>
              {events.map((item) => <option key={item.id} value={item.id}>{item.title || item.name || item.id}</option>)}
            </select>
          </label>
          <label className="w-full xl:w-48">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{TXT.semesterLabel}</span>
            <select value={form.semesterId} onChange={(event) => setForm((prev) => ({ ...prev, semesterId: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{TXT.selectSemester}</option>
              {semesters.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
            </select>
          </label>
          <button type="button" onClick={handleCreateSession} disabled={processing || session?.status === "OPEN"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <span className="material-symbols-outlined text-base">play_circle</span>
            {TXT.createSession}
          </button>
        </div>

        {notice.message && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {notice.message}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div ref={previewRef} className="relative aspect-video overflow-hidden rounded-lg bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoLoadedMetadata}
              className="h-full w-full object-contain"
            />
            <div className="pointer-events-none absolute inset-0 z-10">
              {overlayBoxes.map((box) => {
                const isMatched = box.result === "MATCHED" || box.result === "DUPLICATE";
                const borderClass = isMatched ? "border-emerald-400" : "border-amber-400";
                const badgeClass = isMatched ? "bg-emerald-500/90" : "bg-amber-500/90";
                return (
                  <div
                    key={box.id}
                    className={`absolute rounded-md border-2 ${borderClass} shadow-[0_0_0_1px_rgba(0,0,0,0.12)]`}
                    style={{
                      left: `${box.left}px`,
                      top: `${box.top}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                    }}
                  >
                    <div className={`absolute -top-6 left-0 max-w-[220px] truncate rounded px-2 py-0.5 text-[11px] font-semibold text-white ${badgeClass}`}>
                      {box.label}{isMatched ? ` (${Math.round(box.confidence * 100)}%)` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300 md:grid-cols-3">
            <span>{TXT.detected}: <strong>{scanSummary.detectedFaceCount}</strong></span>
            <span>{TXT.newMatches}: <strong>{scanSummary.matchedCount}</strong></span>
            <span>{TXT.lastScan}: <strong>{scanSummary.lastRecognizedAt || "--:--:--"}</strong></span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={cameraOn ? stopCamera : startCamera} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700">
              <span className="material-symbols-outlined text-base">{cameraOn ? "videocam_off" : "videocam"}</span>
              {cameraOn ? TXT.turnOffCamera : TXT.turnOnCamera}
            </button>
            <button type="button" onClick={() => setAutoScan((prev) => !prev)} disabled={!cameraOn || !session?.id || session?.status !== "OPEN"} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700 disabled:opacity-50">
              <span className="material-symbols-outlined text-base">{autoScan ? "pause_circle" : "autoplay"}</span>
              {autoScan ? TXT.stopAutoScan : TXT.autoScan}
            </button>
            <button type="button" onClick={() => handleRecognize(false)} disabled={!cameraOn || !session?.id || processing || session?.status !== "OPEN"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <span className="material-symbols-outlined text-base">center_focus_strong</span>
              {TXT.scanFrame}
            </button>
            <button type="button" onClick={handleClose} disabled={!session?.id || session?.status !== "OPEN"} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700">
              <span className="material-symbols-outlined text-base">stop_circle</span>
              {TXT.closeSession}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{TXT.matchedStudents}</h3>
            <span className="text-sm text-slate-500">{selectedIds.size}/{matches.length}</span>
          </div>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="text-sm text-slate-500">{TXT.noRecognizedResult}</p>
            ) : (
              matches.map((match) => (
                <label key={match.studentId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <input type="checkbox" checked={selectedIds.has(match.studentId)} onChange={() => toggleSelected(match.studentId)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{match.fullName}</p>
                    <p className="text-xs text-slate-500">{match.studentCode} - {Math.round((match.confidence || 0) * 100)}%</p>
                  </div>
                  {match.duplicate && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">{TXT.duplicate}</span>}
                </label>
              ))
            )}
          </div>
          <button type="button" onClick={handleConfirm} disabled={selectedIds.size === 0 || confirming} className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {TXT.confirmAttendance}
          </button>
        </div>
      </div>
    </section>
  );
}
