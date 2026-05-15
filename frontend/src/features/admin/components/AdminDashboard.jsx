const ALERT_STYLES = {
  high: "border-rose-300 bg-rose-50 text-rose-700",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  low: "border-blue-300 bg-blue-50 text-blue-700",
};

const STATUS_BADGES = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  LOCKED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  DELETED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
}

function formatPercent(value) {
  const safe = Number(value) || 0;
  return `${Math.round(safe * 10) / 10}%`;
}

function OpsKpiCard({ label, value, icon, hint, tone }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 md:gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-500 md:text-sm dark:text-slate-400">{label}</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:mt-2 md:text-3xl dark:text-slate-100">{value}</h3>
          <p className="mt-1 line-clamp-1 text-[10px] text-slate-500 md:mt-2 md:text-xs dark:text-slate-400">{hint}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12 md:rounded-2xl ${tone}`}>
          <span className="material-symbols-outlined text-xl md:text-2xl">{icon}</span>
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboard({ workspace, onNavigate }) {
  const { lecturerWorkspace, studentWorkspace } = workspace;
  const lecturerStats = lecturerWorkspace.stats;
  const studentStats = studentWorkspace.stats;

  const flash = lecturerWorkspace.flash.message ? lecturerWorkspace.flash : studentWorkspace.flash;
  const recentLecturers = lecturerStats.recentLecturers || [];
  const recentStudents = studentStats.recentStudents || [];
  const classBreakdown = studentStats.classBreakdown || [];
  const facultyBreakdown = studentStats.facultyBreakdown || [];

  const totalAssignedStudents = classBreakdown.reduce((sum, item) => sum + (item.studentCount || 0), 0);
  const studentsWithoutClass = Math.max((studentStats.totalStudents || 0) - totalAssignedStudents, 0);
  const lockedAccounts = (lecturerStats.lockedLecturers || 0) + (studentStats.lockedStudents || 0);
  const monitorCoverage = studentStats.totalStudents > 0
    ? (studentStats.monitorStudents / studentStats.totalStudents) * 100
    : 0;
  const facultiesWithoutMonitor = facultyBreakdown.filter(
    (item) => (item.studentCount || 0) > 0 && (item.monitorCount || 0) === 0,
  );

  const actionAlerts = [];
  if (studentsWithoutClass > 0) {
    actionAlerts.push({
      id: "student-no-class",
      level: "high",
      text: `${formatNumber(studentsWithoutClass)} sinh viên chưa gán lớp.`,
      action: "Vào mục Sinh viên để gán lớp ngay.",
    });
  }
  if ((lecturerStats.unassignedLecturers || 0) > 0) {
    actionAlerts.push({
      id: "lecturer-no-assignment",
      level: "high",
      text: `${formatNumber(lecturerStats.unassignedLecturers)} giảng viên chưa được phân công lớp.`,
      action: "Vào mục Giảng viên để phân công khoa/lớp.",
    });
  }
  if (lockedAccounts > 0) {
    actionAlerts.push({
      id: "locked-accounts",
      level: "medium",
      text: `${formatNumber(lockedAccounts)} tài khoản đang bị khóa.`,
      action: "Rà soát trạng thái tài khoản cần mở lại.",
    });
  }
  if (facultiesWithoutMonitor.length > 0) {
    actionAlerts.push({
      id: "faculty-no-monitor",
      level: "medium",
      text: `${formatNumber(facultiesWithoutMonitor.length)} khoa chưa có monitor sinh viên.`,
      action: "Ưu tiên chỉ định monitor theo khoa.",
    });
  }
  if (actionAlerts.length === 0) {
    actionAlerts.push({
      id: "all-good",
      level: "low",
      text: "Không có cảnh báo vận hành quan trọng.",
      action: "Dữ liệu hiện ổn định, tiếp tục theo dõi định kỳ.",
    });
  }

  const topHeavyClasses = [...classBreakdown]
    .sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0))
    .slice(0, 5);

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="overflow-hidden rounded-2xl md:rounded-[28px] border border-rose-100 bg-gradient-to-r from-white via-rose-50 to-orange-50 p-4 md:p-6 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs md:text-sm font-bold uppercase tracking-wider text-primary">
              <span className="material-symbols-outlined text-sm md:text-base">admin_panel_settings</span>
              Admin Operations Dashboard
            </span>
          </div>

          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => onNavigate?.("students")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 transition-transform hover:-translate-y-0.5 hover:border-primary/30 sm:px-4 sm:py-3 sm:text-base"
            >
              <span className="material-symbols-outlined text-lg">groups</span>
              Xử lý sinh viên
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("lecturers")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 transition-transform hover:-translate-y-0.5 hover:border-primary/30 sm:px-4 sm:py-3 sm:text-base"
            >
              <span className="material-symbols-outlined text-lg">badge</span>
              Xử lý giảng viên
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("semesters")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 transition-transform hover:-translate-y-0.5 hover:border-primary/30 sm:px-4 sm:py-3 sm:text-base"
            >
              <span className="material-symbols-outlined text-lg">date_range</span>
              Quản lý học kỳ
            </button>
          </div>
        </div>

        {flash.message ? (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${flash.type === "error" ? "border-rose-300 bg-rose-50 text-rose-700" : flash.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
            {flash.message}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsKpiCard
          label="Việc cần xử lý"
          value={formatNumber(actionAlerts.filter((item) => item.level !== "low").length)}
          icon="notification_important"
          hint="Số cảnh báo ưu tiên trong dashboard"
          tone="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
        />
        <OpsKpiCard
          label="Sinh viên chưa gán lớp"
          value={formatNumber(studentsWithoutClass)}
          icon="person_off"
          hint="Cần gán lớp để không mất dữ liệu vận hành"
          tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <OpsKpiCard
          label="Giảng viên chưa phân lớp"
          value={formatNumber(lecturerStats.unassignedLecturers)}
          icon="assignment_ind"
          hint="Nguy cơ không ai phụ trách lớp"
          tone="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        />
        <OpsKpiCard
          label="Tỷ lệ monitor"
          value={formatPercent(monitorCoverage)}
          icon="workspace_premium"
          hint="Monitor sinh viên trên toàn hệ thống"
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Danh sách cảnh báo vận hành</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tập trung vào các mục có hành động rõ ràng.</p>
            </div>
          </div>

          <div className="space-y-3">
            {actionAlerts.map((alert) => (
              <div key={alert.id} className={`rounded-xl border px-4 py-3 text-sm ${ALERT_STYLES[alert.level] || ALERT_STYLES.low}`}>
                <p className="font-semibold">{alert.text}</p>
                <p className="mt-1">{alert.action}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tài khoản cần rà soát</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Khóa và chưa phân công.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span>Giảng viên bị khóa</span>
              <strong>{formatNumber(lecturerStats.lockedLecturers)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span>Sinh viên bị khóa</span>
              <strong>{formatNumber(studentStats.lockedStudents)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span>Giảng viên chưa phân lớp</span>
              <strong>{formatNumber(lecturerStats.unassignedLecturers)}</strong>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <span>Sinh viên chưa gán lớp</span>
              <strong>{formatNumber(studentsWithoutClass)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Top lớp sĩ số cao</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Theo số sinh viên hiện có để cân đối phụ trách.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("students")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            >
              Mở quản lý SV
            </button>
          </div>

          <div className="space-y-3">
            {topHeavyClasses.length > 0 ? topHeavyClasses.map((item) => (
              <div key={item.classId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.classCode || "Chưa đặt mã lớp"}</p>
                    <p className="text-xs text-slate-500">{item.facultyName || "Chưa gán khoa"} · {item.lecturerName || "Chưa có giảng viên"}</p>
                  </div>
                  <strong className="text-slate-900 dark:text-slate-100">{formatNumber(item.studentCount)} SV</strong>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700">
                Chưa có dữ liệu lớp.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Rủi ro theo khoa</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tập trung vào khoa chưa có monitor và mức phủ monitor thấp.</p>
          </div>

          <div className="space-y-3">
            {facultyBreakdown.length > 0 ? facultyBreakdown.map((item) => {
              const monitorRate = item.studentCount > 0 ? (item.monitorCount / item.studentCount) * 100 : 0;
              return (
                <div key={item.facultyId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.facultyName}</p>
                      <p className="text-xs text-slate-500">{item.facultyCode}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.monitorCount === 0 && item.studentCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {item.monitorCount === 0 && item.studentCount > 0 ? "Cần xử lý" : "Ổn định"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatNumber(item.studentCount)} sinh viên</span>
                    <span>{formatNumber(item.monitorCount)} monitor</span>
                    <span>{formatPercent(monitorRate)}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700">
                Chưa có dữ liệu khoa.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Giảng viên mới cập nhật</h2>
            <button
              type="button"
              onClick={() => onNavigate?.("lecturers")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            >
              Quản lý giảng viên
            </button>
          </div>

          <div className="space-y-3">
            {recentLecturers.length > 0 ? recentLecturers.slice(0, 5).map((lecturer) => (
              <div key={lecturer.lecturerId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{lecturer.fullName}</p>
                    <p className="text-xs text-slate-500">{lecturer.lecturerCode} · {lecturer.email}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGES[lecturer.status] || "bg-slate-100 text-slate-600"}`}>
                    {lecturer.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700">
                Chưa có dữ liệu giảng viên gần đây.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sinh viên mới cập nhật</h2>
            <button
              type="button"
              onClick={() => onNavigate?.("students")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            >
              Quản lý sinh viên
            </button>
          </div>

          <div className="space-y-3">
            {recentStudents.length > 0 ? recentStudents.slice(0, 5).map((student) => (
              <div key={student.studentId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{student.fullName}</p>
                    <p className="text-xs text-slate-500">{student.studentCode} · {student.classCode || "Chưa có lớp"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGES[student.status] || "bg-slate-100 text-slate-600"}`}>
                    {student.status}
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700">
                Chưa có dữ liệu sinh viên gần đây.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
