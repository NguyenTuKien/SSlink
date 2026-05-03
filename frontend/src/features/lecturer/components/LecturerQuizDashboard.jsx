import { useState } from "react";
import { apiRequest } from "../../../shared/api/http";
import Swal from "sweetalert2";

export default function LecturerQuizDashboard({ quizzes, loading, onCreateNew, onEdit, onViewResults, onRefresh, lecturerId }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case "DRAFT":
        return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">NHÁP</span>;
      case "PUBLISHED":
        return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">PHÁT HÀNH</span>;
      case "CLOSED":
        return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-500">ĐÃ ĐÓNG</span>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type) => {
    if (type === "EXAM") {
      return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">KIỂM TRA</span>;
    }
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">ÔN TẬP</span>;
  };

  const handleDelete = async (quizId, quizTitle) => {
    const result = await Swal.fire({
      title: "Xóa đề thi?",
      html: `Bạn có chắc chắn muốn xóa đề thi <b>${quizTitle}</b> không? Thao tác này không thể hoàn tác.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Đồng ý, Xóa!",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      try {
        if (!lecturerId) {
          Swal.fire("Lỗi", "Không tìm thấy thông tin giảng viên.", "error");
          return;
        }
        await apiRequest(`/v1/lecturer/quizzes/${quizId}?lecturerId=${lecturerId}`, { method: "DELETE" });
        Swal.fire("Đã xóa!", "Đề thi đã được xóa khỏi hệ thống.", "success");
        onRefresh();
      } catch (e) {
        Swal.fire("Lỗi", "Không thể xóa đề thi này.", "error");
      }
    }
  };

  const handlePublish = async (quizId) => {
    try {
        await apiRequest(`/v1/lecturer/quizzes/${quizId}/publish?lecturerId=${lecturerId}`, { method: "PATCH" });
        Swal.fire("Thành công", "Đã phát hành đề thi.", "success");
        onRefresh();
    } catch (e) {
        Swal.fire("Lỗi", "Không thể phát hành đề thi.", "error");
    }
  };

  const handleClose = async (quizId) => {
    try {
        await apiRequest(`/v1/lecturer/quizzes/${quizId}/close?lecturerId=${lecturerId}`, { method: "PATCH" });
        Swal.fire("Thành công", "Đã đóng đề thi.", "success");
        onRefresh();
    } catch (e) {
        Swal.fire("Lỗi", "Không thể đóng đề thi.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">quiz</span>
            Quản lý Thi & Ôn tập
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý danh sách đề thi, bài kiểm tra và theo dõi điểm số sinh viên.</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          Tạo đề mới
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex-1">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Danh sách đề thi đã tạo</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4 font-semibold">Tên đề thi</th>
                <th className="px-6 py-4 font-semibold">Phân loại</th>
                <th className="px-6 py-4 font-semibold">Lớp giao</th>
                <th className="px-6 py-4 font-semibold">Thời gian mở/đóng</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined animate-spin text-3xl text-primary">autorenew</span>
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : quizzes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-4xl opacity-50">inbox</span>
                      <p>Chưa có đề thi nào. Hãy tạo mới!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                quizzes.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{quiz.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{quiz.subject} • {quiz.totalQuestions} câu</p>
                    </td>
                    <td className="px-6 py-4">
                      {getTypeBadge(quiz.type)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {quiz.assignedClasses?.map((cls) => (
                          <span key={cls.classId} className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {cls.classCode}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                      <div>Mở: {quiz.startTime ? new Date(quiz.startTime).toLocaleString('vi-VN') : '---'}</div>
                      <div className="mt-1">Đóng: {quiz.endTime ? new Date(quiz.endTime).toLocaleString('vi-VN') : '---'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(quiz.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {quiz.status === "DRAFT" && (
                          <>
                            <button onClick={() => onEdit(quiz)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Chỉnh sửa">
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button onClick={() => handlePublish(quiz.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Phát hành">
                              <span className="material-symbols-outlined text-sm">publish</span>
                            </button>
                          </>
                        )}
                        
                        {quiz.status === "PUBLISHED" && (
                             <button onClick={() => handleClose(quiz.id)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Đóng sớm">
                              <span className="material-symbols-outlined text-sm">block</span>
                            </button>
                        )}

                        {quiz.type === "EXAM" && (
                          <button onClick={() => onViewResults(quiz)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="Xem điểm">
                            <span className="material-symbols-outlined text-sm">visibility</span>
                          </button>
                        )}
                        
                        <button onClick={() => handleDelete(quiz.id, quiz.title)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xóa">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
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
