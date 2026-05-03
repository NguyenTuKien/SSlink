import { useState, useEffect } from "react";
import { apiRequest } from "../../../shared/api/http";
import Swal from "sweetalert2";

export default function StudentQuizDashboard({ studentId, onStartAttempt, onViewResult }) {
  const [activeTab, setActiveTab] = useState("active"); // "active" | "closed"
  const [data, setData] = useState({ activeQuizzes: [], closedQuizzes: [] });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update current time every second for countdowns
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchQuizzes = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const response = await apiRequest(`/v1/student/quizzes?studentId=${studentId}&_t=${Date.now()}`);
      if (response && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch student quizzes", error);
      Swal.fire("Lỗi", "Không thể lấy danh sách bài tập.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const getTypeBadge = (type) => {
    if (type === "EXAM") {
      return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">KIỂM TRA</span>;
    }
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">ÔN TẬP</span>;
  };

  const renderCountdown = (startTime) => {
    const start = new Date(startTime);
    if (start <= now) return null;
    const diff = start - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    
    let text = "Sắp mở trong: ";
    if (days > 0) text += `${days} ngày `;
    if (hours > 0) text += `${hours}h `;
    text += `${mins}m ${secs}s`;
    
    return <div className="text-amber-600 font-medium text-sm mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span>{text}</div>;
  };

  const renderActiveCard = (quiz) => {
    const isUpcoming = quiz.startTime && new Date(quiz.startTime) > now;
    const canEnter = quiz.canAttempt && !isUpcoming;
    
    let btnText = "Vào làm bài";
    if (quiz.attemptStatus === "IN_PROGRESS") btnText = "Tiếp tục làm bài";
    else if (quiz.hasResult && quiz.type === "PRACTICE") btnText = "Làm lại";

    return (
      <div key={quiz.quizId} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-2">{quiz.title}</h3>
            {getTypeBadge(quiz.type)}
          </div>
          <p className="text-sm text-slate-500 mb-4">{quiz.subject} • {quiz.totalQuestions} câu {quiz.timeLimitMinutes ? `• ${quiz.timeLimitMinutes} phút` : ''}</p>
          
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-4">
            <div><span className="font-medium">Mở:</span> {quiz.startTime ? new Date(quiz.startTime).toLocaleString('vi-VN') : '---'}</div>
            <div><span className="font-medium">Đóng:</span> {quiz.endTime ? new Date(quiz.endTime).toLocaleString('vi-VN') : '---'}</div>
          </div>
        </div>

        <div>
          {isUpcoming && renderCountdown(quiz.startTime)}
          {!isUpcoming && !quiz.canAttempt && !quiz.hasResult && (
            <div className="text-red-500 text-sm mt-2 font-medium">Bạn không thể tham gia bài thi này</div>
          )}
          
          <div className="mt-4 flex gap-2">
            <button
              disabled={!canEnter}
              onClick={() => onStartAttempt(quiz.quizId)}
              className={`flex-1 py-2 rounded-xl font-semibold transition-all ${canEnter ? 'bg-primary hover:bg-primary-dark text-white shadow-md hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500'}`}
            >
              {btnText}
            </button>
            {quiz.hasResult && (
              <button
                onClick={() => onViewResult(quiz.quizId)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
                title="Xem kết quả cũ"
              >
                <span className="material-symbols-outlined text-lg">visibility</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderClosedCard = (quiz) => {
    return (
      <div key={quiz.quizId} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 line-clamp-2">{quiz.title}</h3>
            {getTypeBadge(quiz.type)}
          </div>
          <p className="text-sm text-slate-500 mb-4">{quiz.subject} • {quiz.totalQuestions} câu</p>
          
          {quiz.hasResult && quiz.score !== null && quiz.score !== undefined && (
            <div className="mb-4 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
              <span className="text-sm text-slate-500">Điểm số: </span>
              <span className="text-lg font-bold text-primary">{quiz.score}/10</span>
            </div>
          )}
          {!quiz.hasResult && (
            <div className="mb-4 p-3 text-center text-sm text-slate-500">
              Bạn chưa nộp bài hoặc không tham gia.
            </div>
          )}
        </div>

        <button
          disabled={!quiz.hasResult}
          onClick={() => onViewResult(quiz.quizId)}
          className={`w-full py-2 rounded-xl font-semibold transition-all ${quiz.hasResult ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800/30'}`}
        >
          Xem kết quả
        </button>
      </div>
    );
  };

  const listToRender = activeTab === "active" ? data.activeQuizzes : data.closedQuizzes;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">assignment</span>
            Bài Tập / Kiểm Tra
          </h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách các bài thi được giao và kết quả làm bài của bạn.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Đang mở / Sắp tới ({data.activeQuizzes?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("closed")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'closed' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Đã nộp / Hết hạn ({data.closedQuizzes?.length || 0})
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-4">autorenew</span>
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : listToRender?.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
          <span className="material-symbols-outlined text-5xl opacity-50 mb-4">inbox</span>
          <p className="text-lg font-medium">Không có bài thi nào trong mục này</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {activeTab === "active" 
            ? listToRender.map(renderActiveCard)
            : listToRender.map(renderClosedCard)}
        </div>
      )}
    </div>
  );
}
