import { Navigate, Route, Routes } from "react-router-dom";
import AuthLoginPage from "../pages/AuthLoginPage";
import OAuthCallback from "../pages/OAuthCallback";
import AdminPage from "../pages/AdminPage";
import LecturerPage from "../pages/LecturerPage";
import StudentPage from "../pages/StudentPage";
import ProtectedRoute from "../shared/components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";

function HomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={user.dashboardPath || "/student"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth" element={<AuthLoginPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/oauth-success" element={<OAuthCallback />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={["STUDENT", "MONITOR"]}>
            <StudentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard/monitor/class"
        element={
          <ProtectedRoute allowedRoles={["MONITOR"]}>
            <StudentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/lecturer"
        element={
          <ProtectedRoute allowedRoles={["LECTURER", "ADMIN"]}>
            <LecturerPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
