import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../shared/api/http";
import EventDashboard from "../features/lecturer/components/EventDashboard";
import LecturerClassEvaluation from "../features/lecturer/components/LecturerClassEvaluation";
import LecturerDashboardOverview from "../features/lecturer/components/LecturerDashboardOverview";
import LecturerMobileNav from "../features/lecturer/components/LecturerMobileNav";
import LecturerNotificationCenter from "../features/lecturer/components/LecturerNotificationCenter";
import LecturerSidebar from "../features/lecturer/components/LecturerSidebar";
import LecturerStudentManagement from "../features/lecturer/components/LecturerStudentManagement";
import LecturerTopHeader from "../features/lecturer/components/LecturerTopHeader";
import LecturerFaceAttendancePanel from "../features/lecturer/components/LecturerFaceAttendancePanel";
import LecturerFaceUpdateReviewPanel from "../features/lecturer/components/LecturerFaceUpdateReviewPanel";
import LecturerQuizManagement from "../features/lecturer/components/LecturerQuizManagement";

const SIDEBAR_ITEMS_BASE = [
  { key: "dashboard", label: "Tổng quan", icon: "dashboard" },
  { key: "notifications", label: "Thông báo", icon: "notifications" },
  { key: "events", label: "Sự kiện", icon: "calendar_today" },
  { key: "face-attendance", label: "Điểm danh khuôn mặt", icon: "face" },
  { key: "face-review", label: "Duyệt ảnh khuôn mặt", icon: "how_to_reg" },
  { key: "students", label: "Sinh viên", icon: "group" },
  { key: "evaluation", label: "Quản lý điểm rèn luyện", icon: "assignment_turned_in" },
  { key: "quizzes", label: "Thi & Ôn tập", icon: "quiz" },
];

export default function LecturerPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeFeature, setActiveFeature] = useState("dashboard");
  const [mountedFeatures, setMountedFeatures] = useState(() => new Set(["dashboard"]));
  const [shouldOpenCreateEventModal, setShouldOpenCreateEventModal] = useState(false);
  const [dashboardSummaryLoading, setDashboardSummaryLoading] = useState(true);
  const [dashboardSummary, setDashboardSummary] = useState({
    totalEvents: 0,
    totalStudents: 0,
    participatingStudents: 0,
    pendingEvidence: 0,
    newNotifications: 0,
    passRate: 0,
    scoreDistribution: [],
    upcomingEvents: [],
  });

  useEffect(() => {
    setMountedFeatures((prev) => {
      if (prev.has(activeFeature)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeFeature);
      return next;
    });
  }, [activeFeature]);

  useEffect(() => {
    let ignore = false;

    async function loadDashboardSummary() {
      if (!ignore) {
        setDashboardSummaryLoading(true);
      }
      try {
        const data = await apiRequest("/v1/lecturer/dashboard");
        if (!ignore && data) {
          setDashboardSummary({
            totalEvents: data.totalEvents || 0,
            totalStudents: data.totalStudents || 0,
            participatingStudents: data.participatingStudents || 0,
            pendingEvidence: data.pendingEvidence || 0,
            newNotifications: Number(data.newNotifications || 0),
            passRate: data.passRate || 0,
            scoreDistribution: Array.isArray(data.scoreDistribution) ? data.scoreDistribution : [],
            upcomingEvents: Array.isArray(data.upcomingEvents) ? data.upcomingEvents : [],
          });
        }
      } catch {
      } finally {
        if (!ignore) {
          setDashboardSummaryLoading(false);
        }
      }
    }

    loadDashboardSummary();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateEventFromOverview = () => {
    setShouldOpenCreateEventModal(true);
    setActiveFeature("events");
  };

  const handleCreateEventRequestHandled = () => {
    setShouldOpenCreateEventModal(false);
  };

  const handleFeatureSelect = (featureKey) => {
    setShouldOpenCreateEventModal(false);
    setActiveFeature(featureKey);
  };

  const featureComponents = {
    dashboard: {
      Component: LecturerDashboardOverview,
      props: {
        summary: dashboardSummary,
        onCreateEvent: handleCreateEventFromOverview,
        loadingSummary: dashboardSummaryLoading,
      },
    },
    events: {
      Component: EventDashboard,
      props: {
        shouldOpenCreateEventModal,
        onCreateEventRequestHandled: handleCreateEventRequestHandled,
      },
    },
    students: { Component: LecturerStudentManagement, props: {} },
    evaluation: { Component: LecturerClassEvaluation, props: {} },
    notifications: {
      Component: LecturerNotificationCenter,
      props: {},
    },
    "face-attendance": { Component: LecturerFaceAttendancePanel, props: {} },
    "face-review": { Component: LecturerFaceUpdateReviewPanel, props: {} },
    quizzes: { Component: LecturerQuizManagement, props: {} },
  };

  const fullNameLabel = user?.displayName || "Lecturer";
  const userIdLabel = user?.profileCode || user?.userId || "---";
  const avatarLetter = (fullNameLabel || "L").slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      <LecturerTopHeader onLogout={handleLogout} />

      <main className="flex-1 flex flex-col md:flex-row">
        <LecturerSidebar
          items={SIDEBAR_ITEMS_BASE}
          activeFeature={activeFeature}
          onSelect={handleFeatureSelect}
          fullNameLabel={fullNameLabel}
          userIdLabel={userIdLabel}
          avatarLetter={avatarLetter}
        />
        <div className="flex-1 w-full p-4 md:p-8 pb-20 md:pb-8">
          {Object.entries(featureComponents)
            .filter(([key]) => mountedFeatures.has(key))
            .map(([key, value]) => {
              const FeatureComponent = value.Component;
              return (
                <div key={key} className={key === activeFeature ? "block" : "hidden"} aria-hidden={key !== activeFeature}>
                  <FeatureComponent {...value.props} />
                </div>
              );
            })}
        </div>
      </main>

      <LecturerMobileNav activeFeature={activeFeature} onSelect={handleFeatureSelect} onLogout={handleLogout} />
    </div>
  );
}
