import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "../../../shared/api/http";
import Swal from "sweetalert2";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function StudentQuizAttempt({ studentId, quizId, onFinish, onBack }) {
  const [quizDetail, setQuizDetail] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [warnings, setWarnings] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isStarted, setIsStarted] = useState(false);
  const isWarningOpenRef = useRef(false);

  const MAX_WARNINGS = 3;
  const isExam = quizDetail?.type === "EXAM";

  const fetchQuizAndAttempt = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch details
      const detailRes = await apiRequest(`/v1/student/quizzes/${quizId}?_t=${Date.now()}`);
      if (detailRes && detailRes.data) {
        setQuizDetail(detailRes.data);
      }

      // Start or resume attempt
      const attemptRes = await apiRequest(`/v1/student/quizzes/${quizId}/attempt`, { method: "POST" });
      if (attemptRes && attemptRes.data) {
        setAttempt(attemptRes.data);
        setAnswers(attemptRes.data.savedAnswers || {});
      }
    } catch (error) {
      console.error("Failed to start attempt:", error);
      Swal.fire("Lỗi", error.message || "Không thể vào làm bài.", "error").then(() => onBack());
    } finally {
      setLoading(false);
    }
  }, [quizId, onBack]);

  useEffect(() => {
    fetchQuizAndAttempt();
  }, [fetchQuizAndAttempt]);

  // Timer logic
  useEffect(() => {
    if (!quizDetail || !attempt || attempt.status !== "IN_PROGRESS") return;

    // Use backend's remaining time if provided, else compute based on startTime + limit
    let endTime = null;
    if (quizDetail.timeLimitMinutes) {
        const start = new Date(attempt.startTime).getTime();
        endTime = start + quizDetail.timeLimitMinutes * 60000;
    }
    
    // Check if the quiz itself has an absolute end time
    if (quizDetail.endTime) {
        const quizEndTime = new Date(quizDetail.endTime).getTime();
        if (!endTime || quizEndTime < endTime) {
            endTime = quizEndTime;
        }
    }

    if (!endTime) return; // No time limit

    const updateTimer = () => {
      const now = new Date().getTime();
      const remain = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remain);
      
      if (remain <= 0) {
        clearInterval(timer);
        Swal.fire("Hết giờ!", "Hệ thống sẽ tự động nộp bài của bạn.", "info").then(() => {
            handleSubmit();
        });
      }
    };

    updateTimer(); // Initial call
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizDetail, attempt]);

  useEffect(() => {
    if (!isExam || loading || !isStarted) return;

    const handleViolation = (reason) => {
      if (isWarningOpenRef.current) return;
      isWarningOpenRef.current = true;

      setWarnings(w => {
        const newW = w + 1;
        if (newW >= MAX_WARNINGS) {
            Swal.fire({
                title: "Vi phạm nghiêm trọng!",
                text: `${reason} Bạn đã vi phạm quá số lần cho phép. Bài thi sẽ được tự động nộp.`,
                icon: "error",
                allowOutsideClick: false,
                showConfirmButton: true
            }).then(() => {
                isWarningOpenRef.current = false;
                handleSubmit();
            });
        } else {
            Swal.fire({
                title: "Cảnh báo gian lận!",
                text: `${reason} Bạn đã vi phạm ${newW}/${MAX_WARNINGS} lần. Nếu vi phạm ${MAX_WARNINGS} lần, bài thi sẽ tự động nộp.`,
                icon: "warning",
                confirmButtonText: "Quay lại toàn màn hình",
                allowOutsideClick: false
            }).then(() => {
                isWarningOpenRef.current = false;
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(err => console.error(err));
                }
            });
        }
        return newW;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation("Bạn đã chuyển tab hoặc thu nhỏ trình duyệt.");
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("Bạn đã thoát chế độ toàn màn hình.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExam, loading, isStarted]);

  const handleSelectAnswer = async (questionNumber, option) => {
    // Optimistic UI update
    setAnswers(prev => ({ ...prev, [questionNumber]: option }));

    // Auto-save silently
    try {
      await apiRequest(`/v1/student/quizzes/${quizId}/attempt/${attempt.attemptId}/answer`, {
        method: "PATCH",
        body: JSON.stringify({ questionNumber: parseInt(questionNumber, 10), selectedOption: option })
      });
    } catch (error) {
      console.error("Auto-save failed", error);
      // Optional: show a silent toast error
    }
  };

  const handleSubmit = async () => {
    try {
      await apiRequest(`/v1/student/quizzes/${quizId}/attempt/${attempt.attemptId}/submit`, {
        method: "POST"
      });
      Swal.fire("Thành công", "Nộp bài thành công!", "success");
      onFinish(quizId);
    } catch (error) {
      console.error("Submit error", error);
      Swal.fire("Lỗi", error.message || "Không thể nộp bài.", "error");
    }
  };

  const confirmSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    const total = quizDetail.totalQuestions;
    const unanswered = total - answeredCount;

    Swal.fire({
      title: "Xác nhận nộp bài?",
      html: unanswered > 0 
        ? `Bạn còn <b>${unanswered}</b> câu chưa làm. Bạn có chắc chắn muốn nộp không?` 
        : "Bạn đã hoàn thành tất cả câu hỏi. Bạn có muốn nộp bài ngay?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Đồng ý nộp",
      cancelButtonText: "Hủy",
      confirmButtonColor: "#10b981",
    }).then((result) => {
      if (result.isConfirmed) {
        handleSubmit();
      }
    });
  };

  const formatTime = (secs) => {
    if (secs === null) return "--:--:--";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-slate-50 dark:bg-slate-900 absolute inset-0 z-50">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined animate-spin text-5xl text-primary">autorenew</span>
          <p className="text-slate-600 font-medium">Đang tải đề thi...</p>
        </div>
      </div>
    );
  }

  const handleStartFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsStarted(true);
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Trình duyệt của bạn không hỗ trợ toàn màn hình. Vui lòng thử lại.", "error");
    }
  };

  if (isExam && !isStarted) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-slate-50 dark:bg-slate-900 absolute inset-0 z-50">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md text-center border border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl">fullscreen</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Chế độ thi nghiêm ngặt</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Bài thi này yêu cầu làm bài ở chế độ <b>Toàn màn hình</b>. Nếu bạn thoát toàn màn hình hoặc chuyển tab, hệ thống sẽ ghi nhận vi phạm. Vi phạm <b>{MAX_WARNINGS}</b> lần sẽ tự động thu bài.
          </p>
          <button
            onClick={handleStartFullscreen}
            className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-lg shadow-lg hover:-translate-y-1 transition-all"
          >
            Đã hiểu, Bắt đầu làm bài
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden absolute inset-0 z-50">
      {/* Header */}
      <div className="h-16 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{quizDetail.title}</h1>
          {isExam && (
            <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold">CHẾ ĐỘ THI (Cảnh báo: {warnings}/{MAX_WARNINGS})</span>
          )}
        </div>
        
        <div className="flex items-center gap-6">
            <div className={`text-2xl font-bold font-mono tracking-wider px-4 py-1 rounded-lg ${timeLeft !== null && timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200'}`}>
                {formatTime(timeLeft)}
            </div>
            {!isExam && (
                <button onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                    Thoát
                </button>
            )}
        </div>
      </div>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Exam Image */}
        <div className="w-[60%] border-r border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/50 relative">
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit={true}
          >
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

        {/* Right: Bubble Sheet */}
        <div className="w-[40%] flex flex-col bg-white dark:bg-slate-800 relative">
          
          <div className="flex-1 overflow-y-auto p-6 pb-24 scroll-smooth">
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-6">Phiếu trả lời trắc nghiệm</h2>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {Array.from({ length: quizDetail.totalQuestions }).map((_, idx) => {
                const qNum = idx + 1;
                const selected = answers[String(qNum)];
                
                return (
                  <div key={qNum} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition-colors">
                    <span className="w-6 text-right font-semibold text-slate-600 dark:text-slate-400 text-sm">{qNum}.</span>
                    <div className="flex gap-2">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => handleSelectAnswer(qNum, opt)}
                          className={`w-8 h-8 rounded-full border-2 text-sm font-bold flex items-center justify-center transition-all
                            ${selected === opt 
                              ? 'border-primary bg-primary text-white scale-110 shadow-sm' 
                              : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:border-primary/50 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.1)]">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Đã làm: <span className="text-primary font-bold text-base">{Object.keys(answers).length}</span> / {quizDetail.totalQuestions}
            </div>
            <button
              onClick={confirmSubmit}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-1 active:translate-y-0 text-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined">send</span>
              NỘP BÀI
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
