import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useCurrentSemester } from "../../../hooks/useCurrentSemester";
import { useMonitorEvaluationList } from "../hooks/useMonitorEvaluationList";
import MonitorReviewModal from "./MonitorReviewModal";
import "../../../styles/MonitorClass.css";

const TXT = {
  statusSubmitted: "\u0110\u00c3 N\u1ed8P",
  statusMonitorApproved: "L\u1edaP TR\u01af\u1edeNG DUY\u1ec6T",
  statusFinalized: "\u0110\u00c3 CH\u1ed0T",
  statusDraft: "B\u1ea2N NH\u00c1P",
  statusOpen: "CH\u01afA N\u1ed8P",
  colFullName: "H\u1ecd v\u00e0 t\u00ean",
  colFinalScore: "\u0110i\u1ec3m t\u1ed5ng k\u1ebft",
  colStatus: "Tr\u1ea1ng th\u00e1i",
  loadingClassData: "\u0110ang t\u1ea3i d\u1eef li\u1ec7u l\u1edbp...",
  systemError: "H\u1ec7 th\u1ed1ng b\u00e1o l\u1ed7i",
  semesterNotConfigured: "H\u1ec7 th\u1ed1ng ch\u01b0a c\u1ea5u h\u00ecnh h\u1ecdc k\u1ef3.",
  semesterFallback: "H\u1ecdc k\u1ef3...",
  title: "Qu\u1ea3n l\u00fd phi\u1ebfu \u0111i\u1ec3m r\u00e8n luy\u1ec7n",
  subtitle: "Theo d\u00f5i v\u00e0 ph\u00ea duy\u1ec7t k\u1ebft qu\u1ea3 r\u00e8n luy\u1ec7n h\u1ecdc k\u1ef3 hi\u1ec7n t\u1ea1i c\u1ee7a sinh vi\u00ean.",
  semesterFilter: "B\u1ed9 l\u1ecdc h\u1ecdc k\u1ef3",
  statTotalStudents: "T\u1ed4NG SINH VI\u00caN",
  statSubmitted: "S\u1ed0 PHI\u1ebeU \u0110\u00c3 N\u1ed8P",
  statNotSubmitted: "CH\u01afA N\u1ed8P PHI\u1ebeU",
  remindText: "Y\u00eau c\u1ea7u nh\u1eafc nh\u1edf",
  tableTitle: "Danh s\u00e1ch \u0111\u00e1nh gi\u00e1 \u0111i\u1ec3m r\u00e8n luy\u1ec7n",
  colStudentCode: "M\u00e3 sinh vi\u00ean",
  colAction: "H\u00e0nh \u0111\u1ed9ng",
  emptyTable: "Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u \u0111\u00e1nh gi\u00e1 cho h\u1ecdc k\u1ef3 n\u00e0y.",
  alertNoEvaluation: "Sinh vi\u00ean n\u00e0y ch\u01b0a t\u1ea1o phi\u1ebfu \u0111\u00e1nh gi\u00e1.",
  viewApprove: "Xem chi ti\u1ebft / Duy\u1ec7t",
  viewDetail: "Xem chi ti\u1ebft",
  tableInfoPrefix: "Hi\u1ec3n th\u1ecb",
  tableInfoMiddle: "trong s\u1ed1",
  tableInfoSuffix: "sinh vi\u00ean",
};

const STATUS_DISPLAY = {
  SUBMITTED: { label: TXT.statusSubmitted, badge: "badge-submitted" },
  MONITOR_APPROVED: { label: TXT.statusMonitorApproved, badge: "badge-monitor_approved" },
  FINALIZED: { label: TXT.statusFinalized, badge: "badge-finalized" },
  DRAFT: { label: TXT.statusDraft, badge: "badge-draft" },
  OPEN: { label: TXT.statusOpen, badge: "badge-not_submitted" },
};

function getInitials(name) {
  if (!name) return "NA";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[parts.length - 2][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function MonitorScoreManagementTab() {
  const { user } = useAuth();

  const { semesters, activeSemesterId, loading: semesterLoading, error: semesterError } = useCurrentSemester();
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [activeModalStudent, setActiveModalStudent] = useState(null);

  useEffect(() => {
    if (activeSemesterId && !selectedSemester) {
      setSelectedSemester(activeSemesterId);
    }
  }, [activeSemesterId, selectedSemester]);

  const {
    students,
    stats,
    isLoading: listLoading,
    error: listError,
    fetchClassList,
  } = useMonitorEvaluationList(selectedSemester);

  useEffect(() => {
    if (selectedSemester) {
      fetchClassList();
    }
  }, [selectedSemester, fetchClassList]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return students.slice(start, start + itemsPerPage);
  }, [students, currentPage]);

  const totalPages = Math.ceil(students.length / itemsPerPage);

  const handleExportExcel = () => {
    const tableHeader = `<tr><th>MSSV</th><th>${TXT.colFullName}</th><th>${TXT.colFinalScore}</th><th>${TXT.colStatus}</th></tr>`;
    const tableRows = students
      .map(
        (s) => `<tr><td>${s.studentCode}</td><td>${s.fullName}</td><td>${s.finalScore || "--"}</td><td>${s.status || "NOT_SUBMITTED"}</td></tr>`,
      )
      .join("");
    const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body><table border="1">${tableHeader}${tableRows}</table></body></html>`;

    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Danh_Sach_Ren_Luyen.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loading = semesterLoading || listLoading;
  const error = semesterError || listError;

  if (loading && students.length === 0) {
    return <div style={{ padding: "40px", textAlign: "center" }}>{TXT.loadingClassData}</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#d32f2f" }}>
        {TXT.systemError}: {error}
      </div>
    );
  }

  if (semesters.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#d32f2f" }}>
        {TXT.semesterNotConfigured}
      </div>
    );
  }

  const selectedSemesterObj = semesters.find((s) => s.id === Number(selectedSemester));
  const semesterName = selectedSemesterObj?.name || TXT.semesterFallback;

  return (
    <div className="monitor-eval-container">
      <div className="monitor-eval-header">
        <div className="monitor-eval-title">
          <h1>{TXT.title} {user?.classCode ? `- L\u1edbp ${user.classCode}` : ""}</h1>
          <p>{TXT.subtitle}</p>
        </div>
        <div className="monitor-eval-controls">
          <div className="monitor-semester-select">
            <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#64748b" }}>
              calendar_today
            </span>
            <select
              value={selectedSemester || ""}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setCurrentPage(1);
              }}
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name}
                </option>
              ))}
            </select>
          </div>
          <button className="monitor-filter-btn" title={`${TXT.semesterFilter}: ${semesterName}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#64748b" }}>
              filter_list
            </span>
          </button>
        </div>
      </div>

      <div className="monitor-stats-cards">
        <div className="monitor-stat-card">
          <div className="stat-icon blue">
            <span className="material-symbols-outlined">person</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">{TXT.statTotalStudents}</span>
            <span className="stat-value">{String(stats.total).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="monitor-stat-card">
          <div className="stat-icon green">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="stat-info" style={{ width: "100%" }}>
            <span className="stat-label">{TXT.statSubmitted}</span>
            <span className="stat-value">{String(stats.submittedCount).padStart(2, "0")}</span>
            <div className="stat-progress"></div>
          </div>
        </div>

        <div className="monitor-stat-card">
          <div className="stat-icon orange">
            <span className="material-symbols-outlined">more_horiz</span>
          </div>
          <div className="stat-info">
            <span className="stat-label">{TXT.statNotSubmitted}</span>
            <span className="stat-value">{String(stats.notSubmittedCount).padStart(2, "0")}</span>
            <span className="stat-subtext orange">{TXT.remindText}</span>
          </div>
        </div>
      </div>

      <div className="monitor-table-card">
        <div className="table-card-header">
          <h2>{TXT.tableTitle}</h2>
          <div className="table-actions" style={{ flexWrap: "wrap" }}>
            <button className="action-export" onClick={handleExportExcel} style={{ whiteSpace: "nowrap" }}>
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>

        <table className="monitor-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>{TXT.colStudentCode}</th>
              <th>{TXT.colFullName}</th>
              <th style={{ textAlign: "center" }}>{TXT.colFinalScore}</th>
              <th style={{ textAlign: "center" }}>{TXT.colStatus}</th>
              <th style={{ textAlign: "center" }}>{TXT.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  {TXT.emptyTable}
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student, index) => {
                const sType = !student.status || student.status === "OPEN" ? "OPEN" : student.status;
                const statusMeta = STATUS_DISPLAY[sType] || STATUS_DISPLAY.OPEN;

                return (
                  <tr key={student.studentId}>
                    <td className="cell-stt">
                      {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, "0")}
                    </td>
                    <td className="cell-code">{student.studentCode}</td>
                    <td>
                      <div className="cell-student">
                        <div className="student-avatar">{getInitials(student.fullName)}</div>
                        <div className="student-name">{student.fullName}</div>
                      </div>
                    </td>
                    <td className="cell-score final" style={{ textAlign: "center" }}>
                      {student.finalScore || "--"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`status-badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className={student.status === "SUBMITTED" ? "btn-detail" : "btn-detail-view"}
                        onClick={() => {
                          if (!student.evaluationId) {
                            alert(TXT.alertNoEvaluation);
                            return;
                          }
                          setActiveModalStudent(student);
                        }}
                      >
                        {student.status === "SUBMITTED" ? TXT.viewApprove : TXT.viewDetail}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {students.length > 0 && (
          <div className="table-footer">
            <div className="table-info">
              {TXT.tableInfoPrefix} {paginatedStudents.length} {TXT.tableInfoMiddle} {students.length} {TXT.tableInfoSuffix}
            </div>
            <div className="table-pagination">
              <button
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  chevron_left
                </span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`page-btn ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}

              <button
                className="page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {activeModalStudent && (
        <MonitorReviewModal
          evaluationId={activeModalStudent.evaluationId}
          studentName={activeModalStudent.fullName}
          studentCode={activeModalStudent.studentCode}
          isReadOnly={activeModalStudent.status !== "SUBMITTED"}
          onClose={() => setActiveModalStudent(null)}
          onSuccess={() => {
            setActiveModalStudent(null);
            fetchClassList();
          }}
        />
      )}
    </div>
  );
}
