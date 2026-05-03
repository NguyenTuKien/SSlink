import { useState } from "react";
import StudentQuizDashboard from "./StudentQuizDashboard";
import StudentQuizAttempt from "./StudentQuizAttempt";
import StudentQuizResult from "./StudentQuizResult";
import { useAuth } from "../../../context/AuthContext";

export default function StudentQuizManagement() {
  const { user } = useAuth();
  // DASHBOARD, ATTEMPT, RESULT
  const [view, setView] = useState("DASHBOARD");
  const [selectedQuizId, setSelectedQuizId] = useState(null);

  const handleStartAttempt = (quizId) => {
    setSelectedQuizId(quizId);
    setView("ATTEMPT");
  };

  const handleViewResult = (quizId) => {
    setSelectedQuizId(quizId);
    setView("RESULT");
  };

  const handleBackToDashboard = () => {
    setSelectedQuizId(null);
    setView("DASHBOARD");
  };

  return (
    <div className="flex h-full w-full flex-col">
      {view === "DASHBOARD" && (
        <StudentQuizDashboard
          studentId={user?.userId}
          onStartAttempt={handleStartAttempt}
          onViewResult={handleViewResult}
        />
      )}

      {view === "ATTEMPT" && selectedQuizId && (
        <StudentQuizAttempt
          studentId={user?.userId}
          quizId={selectedQuizId}
          onFinish={handleViewResult}
          onBack={handleBackToDashboard}
        />
      )}

      {view === "RESULT" && selectedQuizId && (
        <StudentQuizResult
          studentId={user?.userId}
          quizId={selectedQuizId}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}
