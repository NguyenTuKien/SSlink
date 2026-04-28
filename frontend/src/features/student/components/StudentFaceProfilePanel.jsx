import { useEffect, useMemo, useRef, useState } from "react";
import {
  createStudentFaceUpdateRequest,
  enrollStudentFace,
  getStudentFaceStatus,
  getStudentFaceUpdateRequests,
} from "../../../api/faceApi";

export default function StudentFaceProfilePanel({ required = false, onCompleted }) {
  const noticeTimerRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [requests, setRequests] = useState([]);
  const [image, setImage] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmRealImage, setConfirmRealImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ type: "", message: "" });

  const previewUrl = useMemo(() => {
    if (!image) return "";
    return URL.createObjectURL(image);
  }, [image]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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

  async function loadData() {
    setLoading(true);
    setNotice({ type: "", message: "" });
    try {
      const [statusPayload, requestPayload] = await Promise.all([
        getStudentFaceStatus(),
        getStudentFaceUpdateRequests({ size: 10 }),
      ]);
      setStatus(statusPayload);
      setRequests(Array.isArray(requestPayload?.items) ? requestPayload.items : []);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!image) {
      setNotice({ type: "error", message: "Vui lòng chọn ảnh khuôn mặt." });
      return;
    }
    if (!confirmRealImage) {
      setNotice({ type: "error", message: "Bạn phải xác nhận đây là ảnh thật của mình." });
      return;
    }

    setSubmitting(true);
    setNotice({ type: "", message: "" });
    try {
      if (status?.status === "NOT_ENROLLED") {
        await enrollStudentFace({ image, confirmRealImage });
      } else {
        await createStudentFaceUpdateRequest({ image, reason, confirmRealImage });
      }
      setImage(null);
      setReason("");
      setConfirmRealImage(false);
      await loadData();
      setNotice({ type: "success", message: "Đã gửi yêu cầu. Hệ thống sẽ xử lý ảnh ở chế độ nền." });
      onCompleted?.();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  const notEnrolled = status?.status === "NOT_ENROLLED";
  const canRequestUpdate = status?.canRequestUpdate;

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">Đang tải thông tin ảnh khuôn mặt...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Ảnh khuôn mặt</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {notEnrolled ? "Đăng ký khuôn mặt" : "Hồ sơ khuôn mặt"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {notEnrolled
                ? "Bạn cần tải ảnh thật của mình trước khi dùng điểm danh khuôn mặt."
                : "Ảnh này được dùng làm mốc xác minh khi giảng viên quét điểm danh."}
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {status?.status || "NOT_ENROLLED"}
          </span>
        </div>

        {notice.message && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
              }`}
          >
            {notice.message}
          </div>
        )}

        {!notEnrolled && status?.avatarUrl && (
          <div className="mt-5 flex items-center gap-4">
            <img
              src={status.avatarUrl}
              alt="Ảnh khuôn mặt hiện tại"
              className="h-28 w-28 rounded-lg border border-slate-200 object-cover"
            />
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p>Chất lượng: {status.qualityScore ? Math.round(status.qualityScore * 100) : "--"}%</p>
              <p className="mt-1">{canRequestUpdate ? "Có thể gửi yêu cầu cập nhật." : "Đang có yêu cầu chờ duyệt hoặc hồ sơ bị khóa."}</p>
            </div>
          </div>
        )}
      </div>

      {(notEnrolled || canRequestUpdate || required) && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            <div className="flex h-44 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              {previewUrl ? (
                <img src={previewUrl} alt="Ảnh xem trước" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-4xl text-slate-400">add_a_photo</span>
              )}
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ảnh khuôn mặt</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                  className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              {!notEnrolled && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lý do cập nhật</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Ví dụ: ảnh hiện tại không rõ, khuôn mặt thay đổi nhiều..."
                  />
                </label>
              )}

              <label className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <input
                  type="checkbox"
                  checked={confirmRealImage}
                  onChange={(event) => setConfirmRealImage(event.target.checked)}
                  className="mt-1"
                />
                <span>Tôi cam kết đây là ảnh thật của tôi. Muốn thay đổi ảnh khuôn mặt phải gửi yêu cầu và được duyệt.</span>
              </label>

              <button
                type="submit"
                disabled={submitting || !confirmRealImage}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">{submitting ? "sync" : "verified_user"}</span>
                {notEnrolled ? "Đăng ký ảnh khuôn mặt" : "Gửi yêu cầu cập nhật"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Lịch sử yêu cầu cập nhật</h3>
        <div className="mt-4 space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có yêu cầu cập nhật ảnh.</p>
          ) : (
            requests.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">#{item.id} - {item.status}</p>
                  <p className="text-xs text-slate-500">{item.createdAt || "--"} {item.reviewNote ? `- ${item.reviewNote}` : ""}</p>
                </div>
                {item.newAvatarUrl && <img src={item.newAvatarUrl} alt="" className="h-12 w-12 rounded-md object-cover" />}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
