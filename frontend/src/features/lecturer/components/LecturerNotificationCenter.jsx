import { useEffect, useRef, useState } from "react";
import { createLecturerNotification } from "../../../api/notificationStatisticsApi";
import { apiRequest } from "../../../shared/api/http";
import { useAuth } from "../../../context/AuthContext";

export default function LecturerNotificationCenter() {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [classLoading, setClassLoading] = useState(false);

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [targetType, setTargetType] = useState("ALL");
    const [classId, setClassId] = useState("");
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);

    useEffect(() => {
        const lecturerId = user?.backendUserId || user?.userId || user?.profileCode;
        if (!lecturerId) {
            return;
        }

        let ignore = false;

        async function fetchClasses() {
            setClassLoading(true);
            try {
                const response = await apiRequest(`/lecturer/students/options?lecturerId=${lecturerId}`);
                const raw = response?.data || response;
                const classList = Array.isArray(raw?.classes) ? raw.classes : [];
                if (!ignore) {
                    setClasses(classList);
                    if (classList.length > 0) {
                        setClassId(String(classList[0].id));
                    }
                }
            } catch {
                if (!ignore) {
                    setClasses([]);
                }
            } finally {
                if (!ignore) {
                    setClassLoading(false);
                }
            }
        }

        fetchClasses();
        return () => {
            ignore = true;
        };
    }, [user?.backendUserId, user?.profileCode, user?.userId]);

    useEffect(() => {
        if (!result) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setResult(null);
        }, 5000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [result]);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setResult(null);

        if (!title.trim() || !content.trim()) {
            setError("Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.");
            return;
        }

        if (targetType === "CLASS" && !classId) {
            setError("Vui lòng chọn lớp khi gửi theo CLASS.");
            return;
        }

        setSubmitting(true);
        try {
            const response = await createLecturerNotification({
                title: title.trim(),
                content: content.trim(),
                targetType,
                classId,
                file,
            });
            setResult(response);
            setTitle("");
            setContent("");
            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (err) {
            setError(err.message || "Gửi thông báo thất bại.");
        } finally {
            setSubmitting(false);
        }
    }

    function handleRemoveFile() {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tạo thông báo cho sinh viên</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        API tích hợp: gửi thông báo ALL/CLASS, kèm file và thống kê số lượng email.
                    </p>
                </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
                        Tiêu đề
                        <input
                            className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={200}
                            placeholder="Ví dụ: Thông báo họp lớp"
                        />
                    </label>

                    <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
                        Đối tượng nhận
                        <select
                            className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                            value={targetType}
                            onChange={(event) => setTargetType(event.target.value)}
                        >
                            <option value="ALL">ALL - Tất cả sinh viên</option>
                            <option value="CLASS">CLASS - Theo lớp</option>
                        </select>
                    </label>
                </div>

                {targetType === "CLASS" && (
                    <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
                        Chọn lớp
                        <select
                            className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                            value={classId}
                            onChange={(event) => setClassId(event.target.value)}
                            disabled={classLoading}
                        >
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.classCode}
                                </option>
                            ))}
                            {classes.length === 0 && <option value="">Không có lớp khả dụng</option>}
                        </select>
                    </label>
                )}

                <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
                    Nội dung
                    <textarea
                        className="min-h-32 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="Nhập nội dung thông báo..."
                    />
                </label>

                <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
                    File đính kèm (tuỳ chọn)
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                    />
                    {file && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <span className="truncate">Đã chọn: {file.name}</span>
                            <button
                                type="button"
                                className="shrink-0 rounded-md border border-red-200 px-2 py-1 font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/20"
                                onClick={handleRemoveFile}
                            >
                                Gỡ file
                            </button>
                        </div>
                    )}
                </label>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <p className="font-semibold">Thông báo đã được ghi nhận</p>
                        <p>
                            notificationId: {result.notificationId} - Người nhận: {result.totalRecipients} - Email đã xếp hàng:
                            {" "}
                            {result.queuedEmailCount}/{result.totalRecipients}
                        </p>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={submitting}
                    >
                        {submitting ? "Đang gửi..." : "Gửi thông báo"}
                    </button>
                </div>
            </form>
        </section>
    );
}
