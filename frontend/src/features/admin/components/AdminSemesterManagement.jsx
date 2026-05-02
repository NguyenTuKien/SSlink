import { useState, useEffect, useCallback } from 'react';
import {
  getAllSemestersAdmin,
  createSemester,
  updateSemester,
  deleteSemester,
  toggleActiveSemester,
} from '../../../api/semesterAdminApi';

const EMPTY_FORM = {
  name: '',
  startDate: '',
  endDate: '',
  evaluationStartDate: '',
  evaluationEndDate: '',
  isActive: false,
};

let semesterListCache = null;
let semesterListInFlight = null;

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function AdminSemesterManagement() {
  const [semesters, setSemesters] = useState(() => (Array.isArray(semesterListCache) ? semesterListCache : []));
  const [loading, setLoading] = useState(() => !Array.isArray(semesterListCache));
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchSemesters = useCallback(async ({ force = false } = {}) => {
    if (!force && Array.isArray(semesterListCache)) {
      setSemesters(semesterListCache);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true); setError(null);

    const request = semesterListInFlight || getAllSemestersAdmin();
    if (!semesterListInFlight) {
      semesterListInFlight = request;
    }

    try {
      const res = await request;
      const data = Array.isArray(res) ? res : (res?.data || []);
      semesterListCache = data;
      setSemesters(data);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách học kỳ');
    } finally {
      if (semesterListInFlight === request) {
        semesterListInFlight = null;
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSemesters(); }, [fetchSemesters]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (sem) => {
    setEditingId(sem.id);
    setForm({
      name: sem.name || '',
      startDate: sem.startDate || '',
      endDate: sem.endDate || '',
      evaluationStartDate: sem.evaluationStartDate || '',
      evaluationEndDate: sem.evaluationEndDate || '',
      isActive: sem.isActive || false,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setFormError('Tên học kỳ không được để trống'); return; }
    if (!form.startDate || !form.endDate) { setFormError('Ngày bắt đầu và kết thúc học kỳ là bắt buộc'); return; }
    if (!form.evaluationStartDate || !form.evaluationEndDate) { setFormError('Ngày bắt đầu và kết thúc đánh giá là bắt buộc'); return; }
    if (new Date(form.evaluationStartDate) > new Date(form.evaluationEndDate)) {
      setFormError('Ngày bắt đầu đánh giá phải trước ngày kết thúc đánh giá'); return;
    }
    setSubmitting(true); setFormError(null);
    try {
      if (editingId) {
        await updateSemester(editingId, form);
      } else {
        await createSemester(form);
      }
      setShowModal(false);
      fetchSemesters({ force: true });
    } catch (err) {
      setFormError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa học kỳ "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteSemester(id);
      fetchSemesters({ force: true });
    } catch (err) {
      alert(err.message || 'Xóa học kỳ thất bại');
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await toggleActiveSemester(id);
      fetchSemesters({ force: true });
    } catch (err) {
      alert(err.message || 'Thao tác thất bại');
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Danh sách học kỳ</h1>
          <p style={{ marginTop: '6px', fontSize: '14px', color: '#64748b' }}>
            Thiết lập thời gian học kỳ và thời gian đánh giá điểm rèn luyện.
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: '#3b82f6', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: '10px', fontWeight: 600,
          fontSize: '14px', cursor: 'pointer',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
          Thêm học kỳ
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Đang tải...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#ef4444' }}>{error}</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Tên học kỳ', 'Bắt đầu HK', 'Kết thúc HK', 'Bắt đầu đánh giá', 'Hạn đánh giá', 'Trạng thái', 'Hành động'].map(h => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semesters.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Chưa có học kỳ nào. Hãy thêm học kỳ mới.</td></tr>
              ) : semesters.map((sem, idx) => (
                <tr key={sem.id} style={{ borderBottom: idx < semesters.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: '#1e293b' }}>{sem.name}</td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>{fmt(sem.startDate)}</td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>{fmt(sem.endDate)}</td>
                  <td style={{ padding: '16px', fontSize: '14px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 500 }}>{fmt(sem.evaluationStartDate)}</span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px' }}>
                    <span style={{ color: '#dc2626', fontWeight: 500 }}>{fmt(sem.evaluationEndDate)}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button
                      onClick={() => handleToggleActive(sem.id)}
                      style={{
                        padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        backgroundColor: sem.isActive ? '#dcfce7' : '#f1f5f9',
                        color: sem.isActive ? '#15803d' : '#64748b',
                      }}
                    >
                      {sem.isActive ? 'Đang hoạt động' : 'Không hoạt động'}
                    </button>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => openEdit(sem)} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 12px', border: '1px solid #e2e8f0',
                        borderRadius: '8px', background: '#fff', cursor: 'pointer',
                        fontSize: '13px', color: '#374151', fontWeight: 500,
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span> Sửa
                      </button>
                      <button onClick={() => handleDelete(sem.id, sem.name)} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 12px', border: '1px solid #fecaca',
                        borderRadius: '8px', background: '#fff', cursor: 'pointer',
                        fontSize: '13px', color: '#dc2626', fontWeight: 500,
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span> Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Create/Edit */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px', padding: '32px',
            width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                {editingId ? 'Cập nhật học kỳ' : 'Thêm học kỳ mới'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tên học kỳ */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Tên học kỳ *</label>
                <input type="text" placeholder="VD: HK1-2025-2026"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Ngày học kỳ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Bắt đầu học kỳ *</label>
                  <input type="date" value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Kết thúc học kỳ *</label>
                  <input type="date" value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Thời gian đánh giá */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>schedule</span>
                  Thời gian đánh giá điểm rèn luyện
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Ngày bắt đầu đánh giá *</label>
                    <input type="date" value={form.evaluationStartDate}
                      onChange={e => setForm(f => ({ ...f, evaluationStartDate: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Hạn nộp phiếu *</label>
                    <input type="date" value={form.evaluationEndDate}
                      onChange={e => setForm(f => ({ ...f, evaluationEndDate: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* Trạng thái Active */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="isActive" checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="isActive" style={{ fontSize: '14px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                  Đặt làm học kỳ đang hoạt động
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '28px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{
                padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0',
                background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
              }}>Hủy</button>
              <button onClick={handleSubmit} disabled={submitting} style={{
                padding: '10px 24px', borderRadius: '10px', border: 'none',
                background: submitting ? '#93c5fd' : '#3b82f6',
                color: '#fff', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px',
              }}>
                {submitting ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Tạo học kỳ')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
