import { authFetch } from './authFetch';
import { AUTH_STORAGE_KEY } from '../../context/AuthContext';

const API_BASE_URL = '/api/v1/events';
const API_ADMIN_URL = '/api/v1/admin/events';
const API_LECTURER_URL = '/api/v1/lecturer/events';

const LEGACY_AUTH_STORAGE_KEY = 'unipoint_auth';

function getMutationBase() {
  try {
    const raw =
      localStorage.getItem(AUTH_STORAGE_KEY)
      || localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;
    const role = session?.user?.role ?? '';
    const normalized = role.startsWith('ROLE_') ? role.slice(5) : role;
    return normalized === 'ADMIN' ? API_ADMIN_URL : API_LECTURER_URL;
  } catch {
    return API_LECTURER_URL;
  }
}

export const eventApi = {
  fetchEvents: async (page = 0, size = 10) => {
    const response = await authFetch(`${API_BASE_URL}?page=${page}&size=${size}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    const data = await response.json();

    if (Array.isArray(data.content) && typeof data.totalPages === 'number') {
      return data;
    }

    const springPage = data.page || {};
    return {
      content: data.content || [],
      page: typeof springPage.number === 'number' ? springPage.number : page,
      size: typeof springPage.size === 'number' ? springPage.size : size,
      totalElements: typeof springPage.totalElements === 'number' ? springPage.totalElements : data.content?.length || 0,
      totalPages: typeof springPage.totalPages === 'number' ? springPage.totalPages : 0,
      hasNext: !!(springPage.totalPages && springPage.number + 1 < springPage.totalPages),
      hasPrevious: !!(typeof springPage.number === 'number' && springPage.number > 0)
    };
  },
  
  createEvent: async (eventData) => {
    const base = getMutationBase();
    const response = await authFetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData || {}),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorJson = await response.json();
        throw new Error(errorJson.message || errorJson.error || 'Không thể tạo sự kiện.');
      }

      const errorText = await response.text();
      throw new Error(errorText || 'Không thể tạo sự kiện.');
    }

    return response.json();
  },
  
  updateEvent: async (id, eventData) => {
    const base = getMutationBase();
    const response = await authFetch(`${base}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData || {}),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorJson = await response.json();
        throw new Error(errorJson.message || errorJson.error || 'Không thể cập nhật sự kiện.');
      }

      const errorText = await response.text();
      throw new Error(errorText || 'Không thể cập nhật sự kiện.');
    }

    return response.json();
  },
  
  deleteEvent: async (id) => {
    const base = getMutationBase();
    const response = await authFetch(`${base}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Không thể xóa sự kiện.');
  },

  fetchEventAttendees: async (eventId, page = 0, size = 10) => {
    const response = await authFetch(
      `${API_BASE_URL}/${eventId}/attendees?page=${page}&size=${size}&noCache=true`,
      {
        headers: { 'X-Bypass-Cache': 'true' },
      },
    );
    if (!response.ok) throw new Error('Không thể tải danh sách sinh viên check-in.');
    const data = await response.json();

    // Handle Spring Page format
    if (Array.isArray(data.content) && typeof data.totalPages === 'number') {
      return data;
    }

    const springPage = data.page || {};
    return {
      content: data.content || [],
      page: typeof springPage.number === 'number' ? springPage.number : page,
      size: typeof springPage.size === 'number' ? springPage.size : size,
      totalElements: typeof springPage.totalElements === 'number' ? springPage.totalElements : data.content?.length || 0,
      totalPages: typeof springPage.totalPages === 'number' ? springPage.totalPages : 0,
      hasNext: !!(springPage.totalPages && springPage.number + 1 < springPage.totalPages),
      hasPrevious: !!(typeof springPage.number === 'number' && springPage.number > 0),
    };
  },
};

