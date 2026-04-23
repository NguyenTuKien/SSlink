import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getStudentNotificationUnreadCount } from "../api/notificationStatisticsApi";
import StudentDashboard from "../features/student/components/StudentDashboard";
import QRScanner from "../features/student/components/QRScanner";
import StudentMobileNav from "../features/student/components/StudentMobileNav";
import StudentSidebar from "../features/student/components/StudentSidebar";
import StudentTopHeader from "../features/student/components/StudentTopHeader";
import StudentEventsPanel from "../features/student/components/StudentEventsPanel";
import StudentAttendancePanel from "../features/student/components/StudentAttendancePanel";
import StudentStatisticsPanel from "../features/student/components/StudentStatisticsPanel";
import StudentNotificationsPanel from "../features/student/components/StudentNotificationsPanel";
import StudentEvaluationBoard from "../features/student/StudentEvaluationBoard";
import StudentEvidenceDeclarationPanel from "../features/student/components/StudentEvidenceDeclarationPanel";
import StudentUtilitiesPanel from "../features/student/components/StudentUtilitiesPanel";

function normalizeRole(role) {
  if (!role) return "";
  return String(role).startsWith("ROLE_") ? String(role).slice(5) : String(role);
}

function buildSidebarItems(isMonitor) {
  const baseItems = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "events", label: "Sự kiện", icon: "calendar_month" },
    { key: "notifications", label: "Thông báo", icon: "notifications" },
    { key: "history", label: "Lịch sử hoạt động", icon: "history" },
    { key: "statistics", label: "Thống kê", icon: "bar_chart" },
    { key: "evidence", label: "Khai báo minh chứng", icon: "verified_user" },
    { key: "scan-qr", label: "Quét sự kiện", icon: "qr_code_scanner" },
    { key: "evaluation", label: "Phiếu rèn luyện", icon: "assignment" },
  ];

  if (!isMonitor) {
    return baseItems;
  }

  return [
    ...baseItems,
    { key: "manage-class", label: "Quản lý lớp", icon: "groups" },
  ];
}

import MonitorClass from "../features/monitor/components/MonitorClass";

const FEATURE_COMPONENTS = {
  dashboard: StudentDashboard,
  "scan-qr": QRScanner,
  events: StudentEventsPanel,
  history: StudentAttendancePanel,
  statistics: StudentStatisticsPanel,
  notifications: StudentNotificationsPanel,
  evaluation: StudentEvaluationBoard,
  "manage-class": MonitorClass,
  evidence: StudentEvidenceDeclarationPanel,
  utilities: StudentUtilitiesPanel,
};

export default function StudentPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userRole = normalizeRole(user?.effectiveRole || user?.role);
  const isMonitor = userRole === "MONITOR";

  const [activeFeature, setActiveFeature] = useState("dashboard");
  const [studentUnreadCount, setStudentUnreadCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function fetchUnreadCount() {
      try {
        const payload = await getStudentNotificationUnreadCount();
        if (!ignore) {
          setStudentUnreadCount(Number(payload?.unreadCount || 0));
        }
      } catch {
        if (!ignore) {
          setStudentUnreadCount(0);
        }
      }
    }

    fetchUnreadCount();
    return () => {
      ignore = true;
    };
  }, []);

  const sidebarItems = useMemo(
    () =>
      buildSidebarItems(isMonitor).map((item) =>
        item.key === "notifications" && studentUnreadCount > 0
          ? { ...item, badge: studentUnreadCount }
          : item,
      ),
    [isMonitor, studentUnreadCount],
  );

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const FeatureComponent = FEATURE_COMPONENTS[activeFeature] || StudentDashboard;
  const featureProps =
    activeFeature === "notifications"
      ? { onUnreadCountChange: setStudentUnreadCount }
      : activeFeature === "utilities"
        ? {
            onNavigate: setActiveFeature,
            unreadCount: studentUnreadCount,
            isMonitor,
            onLogout: handleLogout,
          }
        : { onNavigate: setActiveFeature };
  const fullNameLabel = user?.displayName || "Student";
  const userIdLabel = user?.profileCode || user?.userId || "---";
  const avatarLetter = (fullNameLabel || "S").slice(0, 1).toUpperCase();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
      <StudentTopHeader
        fullNameLabel={fullNameLabel}
        userIdLabel={userIdLabel}
        avatarLetter={avatarLetter}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col md:flex-row">
        <StudentSidebar items={sidebarItems} activeFeature={activeFeature} onSelect={setActiveFeature} />

        <div className="flex-1 w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-8 pb-24 md:pb-8">
          <FeatureComponent {...featureProps} />
        </div>
      </main>

      <StudentMobileNav
        activeFeature={activeFeature}
        onSelect={setActiveFeature}
        unreadCount={studentUnreadCount}
      />
    </div>
  );
}

