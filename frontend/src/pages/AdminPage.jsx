import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../features/admin/components/AdminDashboard";
import AdminMobileNav from "../features/admin/components/AdminMobileNav";
import AdminLecturerForm from "../features/admin/components/AdminLecturerForm";
import AdminLecturerManagement from "../features/admin/components/AdminLecturerManagement";
import AdminStudentForm from "../features/admin/components/AdminStudentForm";
import AdminStudentManagement from "../features/admin/components/AdminStudentManagement";
import AdminSidebar from "../features/admin/components/AdminSidebar";
import AdminTopHeader from "../features/admin/components/AdminTopHeader";
import AdminStatistics from "../features/admin/components/AdminStatistics";
import AdminSemesterManagement from "../features/admin/components/AdminSemesterManagement";
import { useAdminLecturerWorkspace } from "../features/admin/hooks/useAdminLecturerWorkspace";
import { useAdminStudentWorkspace } from "../features/admin/hooks/useAdminStudentWorkspace";

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Tổng quan", icon: "dashboard" },
  { key: "lecturers", label: "Giảng viên", icon: "badge" },
  { key: "students", label: "Sinh viên", icon: "groups" },
  { key: "semesters", label: "Học kỳ", icon: "date_range" },
  { key: "statistics", label: "Thống kê", icon: "query_stats" },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const lecturerWorkspace = useAdminLecturerWorkspace();
  const studentWorkspace = useAdminStudentWorkspace();
  const [activeFeature, setActiveFeature] = useState("dashboard");
  const [mountedFeatures, setMountedFeatures] = useState(() => new Set(["dashboard"]));
  const fullNameLabel = user?.displayName || "Administrator";
  const userIdLabel = user?.profileCode || user?.userId || "admin";
  const avatarLetter = (fullNameLabel || "A").slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

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

  const featureRegistry = {
    dashboard: {
      Component: AdminDashboard,
      props: {
        workspace: {
          lecturerWorkspace,
          studentWorkspace,
        },
        onNavigate: setActiveFeature,
      },
    },
    lecturers: {
      Component: AdminLecturerManagement,
      props: { workspace: lecturerWorkspace, onNavigate: setActiveFeature },
    },
    students: {
      Component: AdminStudentManagement,
      props: { studentWorkspace, onNavigate: setActiveFeature },
    },
    semesters: {
      Component: AdminSemesterManagement,
      props: {},
    },
    statistics: {
      Component: AdminStatistics,
      props: { lecturerWorkspace, studentWorkspace },
    },
    createLecturer: {
      Component: AdminLecturerForm,
      props: { workspace: lecturerWorkspace },
    },
    createStudent: {
      Component: AdminStudentForm,
      props: { studentWorkspace },
    },
  };

  const handleSearchChange = (nextKeyword) => {
    lecturerWorkspace.setFilters((previous) => ({
      ...previous,
      keyword: nextKeyword,
    }));

    studentWorkspace.setFilters((previous) => ({
      ...previous,
      keyword: nextKeyword,
    }));

  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-gradient-to-b from-rose-50 via-slate-50 to-white text-slate-900 font-display">
      <AdminTopHeader
        fullNameLabel={fullNameLabel}
        userIdLabel={userIdLabel}
        avatarLetter={avatarLetter}
        searchValue={lecturerWorkspace.filters.keyword || studentWorkspace.filters.keyword}
        onSearchChange={handleSearchChange}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col md:flex-row md:pl-72">
        <AdminSidebar
          items={SIDEBAR_ITEMS}
          activeFeature={activeFeature}
          onSelect={setActiveFeature}
          fullNameLabel={fullNameLabel}
          userIdLabel={userIdLabel}
          avatarLetter={avatarLetter}
          lecturerStats={lecturerWorkspace.stats}
          studentStats={studentWorkspace.stats}
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {Object.entries(featureRegistry)
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

      <AdminMobileNav
        items={SIDEBAR_ITEMS}
        activeFeature={activeFeature}
        onSelect={setActiveFeature}
        onLogout={handleLogout}
      />
    </div>
  );
}
