import { useState, useEffect } from "react";
import { apiRequest } from "../../../shared/api/http";
import Swal from "sweetalert2";

export default function LecturerQuizResults({ quiz, onBack, lecturerId }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      if (!quiz?.id) return;
      setLoading(true);
      try {
        const res = await apiRequest(`/v1/lecturer/quizzes/${quiz.id}/results?lecturerId=${lecturerId}`);
        if (res && res.data) {
          setResults(res.data);
        }
      } catch (error) {
        console.error("Fetch results error:", error);
        Swal.fire("Lỗi", "Không thể lấy bảng điểm.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [quiz, lecturerId]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-500">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Bảng điểm: <span className="text-primary">{quiz?.title}</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-semibold">MSSV</th>
                <th className="px-6 py-4 font-semibold">Họ tên</th>
                <th className="px-6 py-4 font-semibold">Lớp</th>
                <th className="px-6 py-4 font-semibold text-center">Số câu đúng</th>
                <th className="px-6 py-4 font-semibold text-right">Điểm hệ 10</th>
                <th className="px-6 py-4 font-semibold text-right">Ngày nộp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {loading ? (
                 <tr><td colSpan="6" className="text-center py-8">Đang tải...</td></tr>
              ) : results.length === 0 ? (
                 <tr><td colSpan="6" className="text-center py-8">Chưa có học sinh nào nộp bài.</td></tr>
              ) : (
                results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-medium">{r.studentCode}</td>
                    <td className="px-6 py-4">{r.fullName}</td>
                    <td className="px-6 py-4">{r.className}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-emerald-600">{r.correctCount}</span> / {r.totalQuestions}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary">{r.score}</td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {new Date(r.submittedAt).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
