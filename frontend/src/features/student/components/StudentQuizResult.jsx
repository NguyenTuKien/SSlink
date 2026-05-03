import { useState, useEffect } from "react";
import { apiRequest } from "../../../shared/api/http";
import Swal from "sweetalert2";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function StudentQuizResult({ studentId, quizId, onBack }) {
  const [result, setResult] = useState(null);
  const [quizDetail, setQuizDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const [res, detailRes] = await Promise.all([
            apiRequest(`/v1/student/quizzes/${quizId}/result?_t=${Date.now()}`),
            apiRequest(`/v1/student/quizzes/${quizId}?_t=${Date.now()}`)
        ]);
        
        if (res && res.data) {
          setResult(res.data);
        }
        if (detailRes && detailRes.data) {
          setQuizDetail(detailRes.data);
        }
      } catch (error) {
        console.error("Failed to fetch result", error);
        Swal.fire("Lỗi", "Không thể lấy kết quả bài thi.", "error").then(() => onBack());
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [quizId, onBack]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full w-full py-20">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span>
          <p className="text-slate-500">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  if (!result || !quizDetail) return null;

  const isExam = result.quizType === "EXAM";
  const showDetails = result.questionDetails && result.questionDetails.length > 0;

  // Render for EXAM without details (locked)
  if (isExam && !showDetails) {
    return (
      <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto p-4 sm:p-0 mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-3xl">task_alt</span>
              Hoàn thành bài thi
            </h1>
            <p className="text-sm text-slate-500 mt-1">Đã nộp bài lúc: {new Date(result.submittedAt).toLocaleString('vi-VN')}</p>
          </div>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Trở về trang chủ
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Điểm Số Của Bạn</div>
          <div className="text-7xl font-black text-primary drop-shadow-md mb-4">{result.score}<span className="text-4xl text-slate-300 dark:text-slate-600">/10</span></div>
          
          {result.correctCount !== null && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-lg">
              <span className="material-symbols-outlined text-emerald-500">check_circle</span>
              Làm đúng {result.correctCount} / {result.totalQuestions} câu
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-700 dark:text-amber-400 max-w-lg text-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <span className="material-symbols-outlined">lock</span>
              Chi tiết bài làm đã bị khóa
            </div>
            Đây là bài KIỂM TRA. Để đảm bảo tính công bằng, đáp án chi tiết và các câu sai sẽ chỉ được hiển thị sau khi toàn bộ thời gian của ca thi kết thúc.
          </div>
        </div>
      </div>
    );
  }

  // Render Split-Pane for details
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden absolute inset-0 z-50">
      {/* Header */}
      <div className="h-16 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{quizDetail.title} - Chi tiết kết quả</h1>
        </div>
        
        <div className="flex items-center gap-6">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold px-4 py-1.5 rounded-lg flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
                Điểm: <span className="text-xl">{result.score}/10</span>
                <span className="text-sm font-normal ml-2">({result.correctCount}/{result.totalQuestions} đúng)</span>
            </div>
            <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1">
                <span className="material-symbols-outlined text-lg">close</span> Đóng
            </button>
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Exam Image */}
        <div className="w-[60%] border-r border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/50 relative">
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit={true}>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/90 dark:bg-slate-800/90 p-1.5 rounded-xl shadow-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                  <button onClick={() => zoomIn()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors" title="Phóng to">
                    <span className="material-symbols-outlined text-xl">zoom_in</span>
                  </button>
                  <button onClick={() => zoomOut()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors" title="Thu nhỏ">
                    <span className="material-symbols-outlined text-xl">zoom_out</span>
                  </button>
                  <button onClick={() => resetTransform()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors" title="Khôi phục gốc">
                    <span className="material-symbols-outlined text-xl">fit_screen</span>
                  </button>
                </div>
                
                <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                  <img 
                    src={quizDetail.examImageUrl} 
                    alt="Exam content" 
                    className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-xl" 
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>

        {/* Right: Bubble Sheet Results */}
        <div className="w-[40%] flex flex-col bg-white dark:bg-slate-800 relative">
          
          <div className="flex-1 overflow-y-auto p-6 pb-6 scroll-smooth">
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">fact_check</span>
                Phiếu đáp án
            </h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {result.questionDetails.map((detail) => {
                const qNum = detail.questionNumber;
                const studentAns = detail.studentAnswer;
                const correctAns = detail.correctAnswer;
                
                return (
                  <div key={qNum} className={`flex items-center gap-3 p-2 rounded-lg border-2 ${detail.isCorrect ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10' : 'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'}`}>
                    <span className="w-6 text-right font-semibold text-slate-600 dark:text-slate-400 text-sm">{qNum}.</span>
                    <div className="flex gap-2 relative">
                      {['A', 'B', 'C', 'D'].map(opt => {
                        let btnClass = "w-8 h-8 rounded-full border-2 text-sm font-bold flex items-center justify-center opacity-50 cursor-default border-slate-200 text-slate-400 dark:border-slate-700";
                        
                        if (opt === correctAns) {
                            btnClass = "w-8 h-8 rounded-full border-2 text-sm font-bold flex items-center justify-center border-emerald-500 bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-200 dark:ring-emerald-900 z-10 scale-110";
                        } else if (opt === studentAns && !detail.isCorrect) {
                            btnClass = "w-8 h-8 rounded-full border-2 text-sm font-bold flex items-center justify-center border-red-500 bg-red-50 text-red-500 dark:bg-red-900/30 relative";
                            return (
                                <div key={opt} className="relative">
                                    <button className={btnClass}>{opt}</button>
                                    <div className="absolute inset-0 flex items-center justify-center text-red-500" style={{ transform: 'scale(1.5)' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                </div>
                            );
                        }
                        
                        return <button key={opt} className={btnClass}>{opt}</button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
