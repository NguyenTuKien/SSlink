import { useState, useEffect } from "react";
import { apiRequest } from "../../../shared/api/http";
import LecturerQuizDashboard from "./LecturerQuizDashboard";
import LecturerQuizCreateForm from "./LecturerQuizCreateForm";
import LecturerQuizResults from "./LecturerQuizResults"; // We'll create this later or just a placeholder
import { useAuth } from "../../../context/AuthContext";
import Swal from "sweetalert2";

export default function LecturerQuizManagement() {
  const { user } = useAuth();
  const [view, setView] = useState("DASHBOARD"); // DASHBOARD, CREATE_EDIT, RESULTS
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null); // For edit or view results

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      // Adjusted the API call according to backend path pattern.
      // Backend expects lecturerId as query param: /lecturer/quizzes?lecturerId=xxx
      // Added cache-buster to prevent browser from returning stale cached data
      const response = await apiRequest(`/v1/lecturer/quizzes?lecturerId=${user.userId}&_t=${Date.now()}`);
      if (response && response.data) {
        setQuizzes(response.data);
      } else {
        setQuizzes([]);
      }
    } catch (error) {
      console.error("Failed to fetch quizzes:", error);
      Swal.fire("Lỗi", "Không thể lấy danh sách đề thi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.userId && view === "DASHBOARD") {
      fetchQuizzes();
    }
  }, [user, view]);

  const handleCreateNew = () => {
    setSelectedQuiz(null);
    setView("CREATE_EDIT");
  };

  const handleEdit = (quiz) => {
    setSelectedQuiz(quiz);
    setView("CREATE_EDIT");
  };

  const handleViewResults = (quiz) => {
    setSelectedQuiz(quiz);
    setView("RESULTS");
  };

  const handleBackToDashboard = (shouldRefresh = false) => {
    setView("DASHBOARD");
    setSelectedQuiz(null);
    if (shouldRefresh) {
      fetchQuizzes();
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      {view === "DASHBOARD" && (
        <LecturerQuizDashboard
          quizzes={quizzes}
          loading={loading}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onViewResults={handleViewResults}
          onRefresh={fetchQuizzes}
          lecturerId={user?.userId}
        />
      )}

      {view === "CREATE_EDIT" && (
        <LecturerQuizCreateForm
          quizToEdit={selectedQuiz}
          onBack={handleBackToDashboard}
          lecturerId={user?.userId}
        />
      )}

      {view === "RESULTS" && (
        <LecturerQuizResults
          quiz={selectedQuiz}
          onBack={() => handleBackToDashboard(false)}
          lecturerId={user?.userId}
        />
      )}
    </div>
  );
}
