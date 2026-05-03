import { useState, useEffect, useRef } from "react";
import { apiRequest } from "../../../shared/api/http";
import Swal from "sweetalert2";

export default function LecturerQuizCreateForm({ quizToEdit, onBack, lecturerId }) {
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    type: "EXAM",
    examImageUrl: "",
    totalQuestions: "",
    timeLimitMinutes: "",
    startTime: "",
    endTime: "",
    classIds: [],
    answerKeys: [],
  });

  const fileInputRef = useRef(null);

  // Initialize form if editing
  useEffect(() => {
    if (quizToEdit) {
      setFormData({
        title: quizToEdit.title || "",
        subject: quizToEdit.subject || "",
        type: quizToEdit.type || "EXAM",
        examImageUrl: quizToEdit.examImageUrl || "",
        totalQuestions: quizToEdit.totalQuestions || "",
        timeLimitMinutes: quizToEdit.timeLimitMinutes || "",
        startTime: quizToEdit.startTime ? new Date(quizToEdit.startTime).toISOString().slice(0, 16) : "",
        endTime: quizToEdit.endTime ? new Date(quizToEdit.endTime).toISOString().slice(0, 16) : "",
        classIds: quizToEdit.assignedClasses ? quizToEdit.assignedClasses.map(c => c.classId) : [],
        answerKeys: [], // Usually we'd fetch this separately, but let's assume we need to rebuild or we fetch if editing
      });
      // In a real app, you'd fetch the answer keys for the quiz being edited.
      // For now, if editing, we might just warn that answer keys need re-entering or we'd fetch them.
    }
  }, [quizToEdit]);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        // Backend returns LecturerStudentOptionsResponse directly, which has a 'classes' array.
        const response = await apiRequest(`/lecturer/students/options?lecturerId=${lecturerId}`);
        if (response && response.classes) {
          setAvailableClasses(response.classes);
        }
      } catch (error) {
        console.error("Failed to fetch classes:", error);
      } finally {
        setLoadingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  // Handle generic input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Auto-generate answer keys when totalQuestions changes
  useEffect(() => {
    const count = parseInt(formData.totalQuestions, 10);
    if (!isNaN(count) && count > 0) {
      setFormData(prev => {
        const newKeys = [];
        for (let i = 1; i <= count; i++) {
          // Keep existing if available
          const existing = prev.answerKeys.find(k => k.questionNumber === i);
          newKeys.push(existing || { questionNumber: i, correctOption: "" });
        }
        return { ...prev, answerKeys: newKeys };
      });
    } else {
      setFormData(prev => ({ ...prev, answerKeys: [] }));
    }
  }, [formData.totalQuestions]);

  const handleAnswerChange = (questionNumber, option) => {
    setFormData(prev => ({
      ...prev,
      answerKeys: prev.answerKeys.map(k => 
        k.questionNumber === questionNumber ? { ...k, correctOption: option } : k
      )
    }));
  };

  const handleClassToggle = (classId) => {
    setFormData(prev => {
      const isSelected = prev.classIds.includes(classId);
      if (isSelected) {
        return { ...prev, classIds: prev.classIds.filter(id => id !== classId) };
      } else {
        return { ...prev, classIds: [...prev.classIds, classId] };
      }
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire("Lỗi", "Kích thước ảnh tối đa là 10MB.", "error");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      Swal.fire("Lỗi", "Chỉ hỗ trợ ảnh định dạng JPG, PNG, WEBP, GIF.", "error");
      return;
    }

    setIsUploading(true);
    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      const response = await apiRequest(`/v1/lecturer/quizzes/upload-image?lecturerId=${lecturerId}`, {
        method: "POST",
        body: uploadData
      });

      if (response && response.data && response.data.imageUrl) {
        setFormData(prev => ({ ...prev, examImageUrl: response.data.imageUrl }));
        Swal.fire({ title: "Thành công", text: "Tải ảnh lên thành công", icon: "success", toast: true, position: "top-end", timer: 2000, showConfirmButton: false });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire("Lỗi", "Không thể tải ảnh lên. Vui lòng thử lại.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
       // Mock the event object for handleImageUpload
       const mockEvent = { target: { files: [e.dataTransfer.files[0]] } };
       handleImageUpload(mockEvent);
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) return "Tên đề thi không được để trống.";
    if (!formData.examImageUrl) return "Vui lòng tải lên ảnh đề thi.";
    if (!formData.totalQuestions || formData.totalQuestions <= 0) return "Số câu hỏi không hợp lệ.";
    if (!formData.startTime) return "Vui lòng chọn thời gian mở đề.";
    if (formData.type === "EXAM") {
      if (!formData.timeLimitMinutes || formData.timeLimitMinutes <= 0) return "Đề kiểm tra phải có thời gian làm bài.";
      if (!formData.endTime) return "Đề kiểm tra phải có thời gian đóng đề.";
    }
    if (formData.classIds.length === 0) return "Vui lòng chọn ít nhất một lớp được giao.";
    
    // Check answer keys
    const unanswered = formData.answerKeys.filter(k => !k.correctOption);
    if (unanswered.length > 0) {
      return `Vui lòng chọn đáp án cho câu: ${unanswered.map(u => u.questionNumber).join(", ")}.`;
    }
    return null;
  };

  const handleSubmit = async (status) => {
    const errorMsg = validateForm();
    if (errorMsg) {
      Swal.fire("Thiếu thông tin", errorMsg, "warning");
      return;
    }

    const payload = {
      ...formData,
      status: status, // "DRAFT" or "PUBLISHED"
      totalQuestions: parseInt(formData.totalQuestions, 10),
      timeLimitMinutes: formData.timeLimitMinutes ? parseInt(formData.timeLimitMinutes, 10) : null,
      startTime: formData.startTime.length === 16 ? formData.startTime + ":00" : formData.startTime,
      endTime: formData.endTime ? (formData.endTime.length === 16 ? formData.endTime + ":00" : formData.endTime) : null,
    };

    setIsSaving(true);
    try {
      if (quizToEdit) {
        await apiRequest(`/v1/lecturer/quizzes/${quizToEdit.id}?lecturerId=${lecturerId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest(`/v1/lecturer/quizzes?lecturerId=${lecturerId}`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      
      Swal.fire("Thành công", status === "DRAFT" ? "Đã lưu nháp." : "Đã phát hành đề thi.", "success");
      onBack(true); // true to refresh list
    } catch (error) {
      console.error("Save error:", error);
      Swal.fire("Lỗi", "Không thể lưu đề thi.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => onBack()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-500">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {quizToEdit ? "Chỉnh sửa Đề thi" : "Tạo Đề Mới"}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Forms */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          
          {/* KHU VỰC 1: THIẾT LẬP CHUNG */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold mb-4 text-slate-700 dark:text-slate-200 border-b pb-2">1. Thông tin chung</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Tên đề thi *</label>
                <input 
                  type="text" name="title" value={formData.title} onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                  placeholder="VD: Kiểm tra giữa kỳ môn Cấu trúc dữ liệu"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Môn học</label>
                  <input 
                    type="text" name="subject" value={formData.subject} onChange={handleChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Loại đề *</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="type" value="PRACTICE" checked={formData.type === "PRACTICE"} onChange={handleChange} className="accent-primary w-4 h-4" />
                      <span className="text-sm font-medium">Ôn tập</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="type" value="EXAM" checked={formData.type === "EXAM"} onChange={handleChange} className="accent-red-500 w-4 h-4" />
                      <span className="text-sm font-medium">Kiểm tra</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {formData.type === "EXAM" && (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Thời gian (phút) *</label>
                    <input 
                      type="number" name="timeLimitMinutes" value={formData.timeLimitMinutes} onChange={handleChange} min="1"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                )}
                <div className={formData.type !== "EXAM" ? "col-span-1 sm:col-span-2" : ""}>
                  <label className="block text-sm font-semibold mb-1">Giờ mở đề *</label>
                  <input 
                    type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className={formData.type !== "EXAM" ? "col-span-1 sm:col-span-1" : ""}>
                  <label className="block text-sm font-semibold mb-1">Giờ đóng đề {formData.type === "EXAM" ? "*" : ""}</label>
                  <input 
                    type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* KHU VỰC 2: CẤU TRÚC ĐỀ */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold mb-4 text-slate-700 dark:text-slate-200 border-b pb-2">2. Cấu trúc đề & Ảnh</h2>
            
            <div className="space-y-6">
              {/* Image Upload Area */}
              <div>
                <label className="block text-sm font-semibold mb-2">Upload Ảnh Đề Thi *</label>
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors
                    ${formData.examImageUrl ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <input 
                    type="file" ref={fileInputRef} onChange={handleImageUpload} accept=".jpg,.png,.jpeg,.webp,.gif"
                    className="hidden" 
                  />
                  
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-primary">
                      <span className="material-symbols-outlined animate-spin text-4xl">autorenew</span>
                      <p>Đang tải ảnh lên Cloudinary...</p>
                    </div>
                  ) : formData.examImageUrl ? (
                    <div className="flex flex-col items-center gap-4">
                      <img src={formData.examImageUrl} alt="Exam Preview" className="max-h-64 object-contain rounded-lg shadow" />
                      <button 
                        onClick={() => fileInputRef.current.click()}
                        className="text-sm bg-white dark:bg-slate-800 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 shadow-sm"
                      >
                        Đổi ảnh khác
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => fileInputRef.current.click()}>
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">Click hoặc kéo thả ảnh vào đây</p>
                        <p className="text-xs text-slate-500 mt-1">Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Tổng số câu hỏi *</label>
                <div className="flex gap-4 items-center">
                  <input 
                    type="number" name="totalQuestions" value={formData.totalQuestions} onChange={handleChange} min="1" max="200"
                    className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                  />
                  <span className="text-sm text-slate-500 italic">Phiếu đáp án sẽ tự động tạo bên dưới</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column - Answer Keys & Actions */}
        <div className="col-span-1 flex flex-col gap-6">
          
          {/* KHU VỰC 3: GIAO VIỆC & LƯU */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold mb-4 text-slate-700 dark:text-slate-200 border-b pb-2">3. Phát hành</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Giao cho Lớp *</label>
              {loadingClasses ? (
                <div className="animate-pulse flex gap-2"><div className="w-4 h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-24"></div></div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-slate-50 dark:bg-slate-800/30">
                  {availableClasses.map(cls => (
                    <label key={cls.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={formData.classIds.includes(cls.id)}
                        onChange={() => handleClassToggle(cls.id)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                      />
                      <span className="font-medium text-sm">{cls.classCode}</span>
                    </label>
                  ))}
                  {availableClasses.length === 0 && (
                    <p className="text-sm text-slate-500 italic">Không có lớp nào.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <button 
                onClick={() => handleSubmit("PUBLISHED")}
                disabled={isSaving}
                className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold shadow-md shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSaving ? <span className="material-symbols-outlined animate-spin">autorenew</span> : <span className="material-symbols-outlined">publish</span>}
                Phát hành ngay
              </button>
              
              <button 
                onClick={() => handleSubmit("DRAFT")}
                disabled={isSaving}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-70"
              >
                Lưu nháp
              </button>
            </div>
          </div>

          {/* ANSWER KEYS MATRIX */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex-1 flex flex-col min-h-[400px]">
            <h2 className="text-lg font-bold mb-4 text-slate-700 dark:text-slate-200 border-b pb-2 flex justify-between items-center">
              Phiếu đáp án
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{formData.answerKeys.length} câu</span>
            </h2>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {formData.answerKeys.length === 0 ? (
                <div className="text-center text-slate-400 mt-10">
                  <span className="material-symbols-outlined text-4xl opacity-50 mb-2">grid_on</span>
                  <p className="text-sm">Nhập tổng số câu hỏi để tạo phiếu.</p>
                </div>
              ) : (
                formData.answerKeys.map((key) => (
                  <div key={key.questionNumber} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                    <span className="w-12 font-bold text-slate-600 dark:text-slate-400 text-sm">C. {key.questionNumber}</span>
                    <div className="flex gap-2">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleAnswerChange(key.questionNumber, opt)}
                          className={`w-8 h-8 rounded-full text-sm font-bold transition-all ${
                            key.correctOption === opt 
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-110' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
