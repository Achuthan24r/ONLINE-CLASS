const API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (import.meta.env.DEV ? 'http://localhost:5000' : '');

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('classorbit_admin_token');
    const participantToken = localStorage.getItem('classorbit_participant_token');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (participantToken) {
      headers['x-participant-token'] = participantToken;
    }

    const config = {
      ...options,
      headers,
      credentials: 'include', // send HTTP-only cookies
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data?.error?.message || `HTTP ${response.status}: Request failed`);
        error.code = data?.error?.code || 'API_ERROR';
        error.status = response.status;
        error.details = data?.error?.details;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const networkErr = new Error('Cannot connect to server. Please ensure the backend is running.');
        networkErr.code = 'NETWORK_ERROR';
        throw networkErr;
      }
      throw err;
    }
  }

  // Auth
  login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  getMe() {
    return this.request('/api/auth/me');
  }

  // Classrooms
  createClassroom(data) {
    return this.request('/api/classrooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getClassrooms() {
    return this.request('/api/classrooms');
  }

  getClassroomById(id) {
    return this.request(`/api/classrooms/${id}`);
  }

  endClassroom(id) {
    return this.request(`/api/classrooms/${id}/end`, { method: 'POST' });
  }

  createInvitation(classroomId, data = {}) {
    return this.request(`/api/classrooms/${classroomId}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  revokeInvitation(classroomId, inviteId) {
    return this.request(`/api/classrooms/${classroomId}/invitations/${inviteId}/revoke`, {
      method: 'POST',
    });
  }

  // Invitations & Student Joining
  validateInvitation(code) {
    return this.request(`/api/invitations/validate/${code}`);
  }

  joinClassroom(code, displayName) {
    return this.request('/api/invitations/join', {
      method: 'POST',
      body: JSON.stringify({ code, displayName }),
    });
  }

  // Media Permissions
  requestPermission(classroomId, mediaType, participantId) {
    return this.request(`/api/classrooms/${classroomId}/permissions/request`, {
      method: 'POST',
      body: JSON.stringify({ mediaType, participantId }),
    });
  }

  reviewPermission(classroomId, requestId, action) {
    return this.request(`/api/classrooms/${classroomId}/permissions/review`, {
      method: 'POST',
      body: JSON.stringify({ requestId, action }),
    });
  }

  revokePermission(classroomId, participantId, mediaType) {
    return this.request(`/api/classrooms/${classroomId}/permissions/revoke`, {
      method: 'POST',
      body: JSON.stringify({ participantId, mediaType }),
    });
  }

  // Moderation
  removeParticipant(classroomId, participantId) {
    return this.request(`/api/classrooms/${classroomId}/participants/${participantId}/remove`, {
      method: 'POST',
    });
  }

  getAuditLogs(classroomId) {
    return this.request(`/api/classrooms/${classroomId}/audit-logs`);
  }

  // LiveKit token refresh
  getClassroomToken(classroomId) {
    return this.request(`/api/classrooms/${classroomId}/token`);
  }

  // Attendance Register
  markAttendance(classroomId, { participantId, studentName, mobileNumber }) {
    return this.request(`/api/classrooms/${classroomId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ participantId, studentName, mobileNumber }),
    });
  }

  getAttendance(classroomId) {
    return this.request(`/api/classrooms/${classroomId}/attendance`);
  }

  updateAttendance(classroomId, attendanceId, updates) {
    return this.request(`/api/classrooms/${classroomId}/attendance/${attendanceId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Attendance CSV & Storage Maintenance
  async downloadClassroomCSV(classroomId, defaultFilename = 'attendance.csv') {
    const token = localStorage.getItem('classorbit_admin_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}/api/classrooms/${classroomId}/attendance.csv`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to download CSV');
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  }

  async downloadDailyCSV(date = '', defaultFilename = 'daily_attendance.csv') {
    const token = localStorage.getItem('classorbit_admin_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = date ? `${this.baseUrl}/api/attendance/daily.csv?date=${encodeURIComponent(date)}` : `${this.baseUrl}/api/attendance/daily.csv`;
    const res = await fetch(url, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to download daily CSV');
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return true;
  }

  acknowledgeAttendance(classroomId) {
    return this.request(`/api/classrooms/${classroomId}/attendance/acknowledge`, {
      method: 'POST',
    });
  }

  getStorageStatus() {
    return this.request('/api/admin/storage-status');
  }

  triggerCleanup() {
    return this.request('/api/admin/cleanup', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
