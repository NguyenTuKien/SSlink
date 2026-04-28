import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getStudentFaceStatus } from "../api/faceApi";
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
import StudentFaceProfilePanel from "../features/student/components/StudentFaceProfilePanel";
import MonitorClass from "../features/monitor/components/MonitorClass";

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
    { key: "face-profile", label: "Ảnh khuôn mặt", icon: "face" },
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
  "face-profile": StudentFaceProfilePanel,
};

export default function StudentPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const userRole = normalizeRole(user?.effectiveRole || user?.role);
  const isMonitor = userRole === "MONITOR";

  const [activeFeature, setActiveFeature] = useState("dashboard");
  const [mountedFeatures, setMountedFeatures] = useState(() => new Set(["dashboard"]));
  const [studentUnreadCount, setStudentUnreadCount] = useState(0);
  const [requiresFaceEnrollment, setRequiresFaceEnrollment] = useState(false);

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

  useEffect(() => {
    let ignore = false;

    async function checkFaceStatus() {
      try {
        const payload = await getStudentFaceStatus();
        if (!ignore) {
          setRequiresFaceEnrollment(payload?.status === "NOT_ENROLLED");
        }
      } catch {
        if (!ignore) {
          setRequiresFaceEnrollment(false);
        }
      }
    }

    checkFaceStatus();
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

  const featurePropsByKey = {
    dashboard: { onNavigate: setActiveFeature },
    "scan-qr": { onNavigate: setActiveFeature },
    events: { onNavigate: setActiveFeature },
    history: { onNavigate: setActiveFeature },
    statistics: { onNavigate: setActiveFeature },
    notifications: { onUnreadCountChange: setStudentUnreadCount },
    evaluation: { onNavigate: setActiveFeature },
    "manage-class": { onNavigate: setActiveFeature },
    evidence: { onNavigate: setActiveFeature },
    "face-profile": { onNavigate: setActiveFeature },
  };
  const fullNameLabel = user?.displayName || "Student";
  const userIdLabel = user?.profileCode || user?.userId || "---";
  const avatarLetter = (fullNameLabel || "S").slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

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

        <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-20 md:pb-8">
          {Object.entries(FEATURE_COMPONENTS)
            .filter(([key]) => mountedFeatures.has(key))
            .map(([key, FeatureComponent]) => (
              <div key={key} className={key === activeFeature ? "block" : "hidden"} aria-hidden={key !== activeFeature}>
                <FeatureComponent {...(featurePropsByKey[key] || {})} />
              </div>
            ))}
        </div>
      </main>

      <StudentMobileNav
        activeFeature={activeFeature}
        onSelect={setActiveFeature}
        onLogout={handleLogout}
        unreadCount={studentUnreadCount}
      />

      {requiresFaceEnrollment && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 max-w-4xl rounded-lg bg-slate-50 p-4 shadow-2xl dark:bg-slate-950">
            <StudentFaceProfilePanel required onCompleted={() => setRequiresFaceEnrollment(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
