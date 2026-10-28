const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

function handleAuthError(status) {
  if (status === 401) {
    // Clear stale token and force re-login by reloading the page
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token_version');
    // Small delay to allow any current renders to finish
    setTimeout(() => window.location.reload(), 100);
  }
}

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed. Check your credentials.');
    }
    return res.json();
  },

  async register(name, email, password, role = 'candidate') {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return null; }
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  async getDemoUsers() {
    const res = await fetch(`${API_BASE}/auth/demo-users`);
    if (!res.ok) return [];
    return res.json();
  },

  // Projects
  async getProjects() {
    const res = await fetch(`${API_BASE}/projects`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load projects');
    return res.json();
  },

  async createProject(name, description) {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description })
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired. Logging you out...'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create project');
    }
    return res.json();
  },

  async createModule(projectId, name, description) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/modules`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description })
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create module');
    }
    return res.json();
  },

  // Tasks
  async getTasks(moduleId = null) {
    const url = moduleId ? `${API_BASE}/tasks?module_id=${moduleId}` : `${API_BASE}/tasks`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load tasks');
    return res.json();
  },

  async getTask(taskId) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) throw new Error('Failed to load task details');
    return res.json();
  },

  async createTask(taskData) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create task');
    }
    return res.json();
  },

  async updateTask(taskId, updates) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update task');
    }
    return res.json();
  },

  async assignTask(taskId, candidateName, candidateEmail) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidate_name: candidateName, candidate_email: candidateEmail })
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to assign candidate');
    }
    return res.json();
  },

  async uploadReferenceDoc(taskId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/tasks/${taskId}/reference-docs`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload reference document');
    }
    return res.json();
  },

  // AI Mentor
  async getMentorMessages(taskId) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/mentor/messages`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load AI mentor messages');
    return res.json();
  },

  async sendMentorMessage(taskId, content) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/mentor/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content })
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to get mentor response');
    }
    return res.json();
  },

  // Reviews & Submissions
  async submitDocument(taskId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit document for review');
    }
    return res.json();
  },

  async getTaskSubmissions(taskId) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/submissions`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load submissions');
    return res.json();
  },

  async getTaskReviews(taskId) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/reviews`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load review reports');
    return res.json();
  },

  async getReviewReport(reviewId) {
    const res = await fetch(`${API_BASE}/reviews/${reviewId}`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) throw new Error('Failed to load review details');
    return res.json();
  },

  // Reminders & Email Logs
  async getEmailLogs(taskId = null) {
    const url = taskId ? `${API_BASE}/reminders/logs?task_id=${taskId}` : `${API_BASE}/reminders/logs`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load email logs');
    return res.json();
  },

  async getReminderRecords() {
    const res = await fetch(`${API_BASE}/reminders/records`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return []; }
    if (!res.ok) throw new Error('Failed to load reminder records');
    return res.json();
  },

  async triggerReminderCheck() {
    const res = await fetch(`${API_BASE}/reminders/check`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) throw new Error('Failed to trigger reminder scan');
    return res.json();
  },

  // SMTP Configuration
  async getSmtpStatus() {
    const res = await fetch(`${API_BASE}/reminders/smtp-status`, { headers: getAuthHeaders() });
    if (res.status === 401) { handleAuthError(401); return null; }
    if (!res.ok) throw new Error('Failed to load SMTP status');
    return res.json();
  },

  async saveSmtpSettings(payload) {
    const res = await fetch(`${API_BASE}/reminders/save-smtp`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save SMTP settings');
    }
    return res.json();
  },

  async sendTestEmail(recipientEmail) {
    const res = await fetch(`${API_BASE}/reminders/test-email`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ recipient_email: recipientEmail })
    });
    if (res.status === 401) { handleAuthError(401); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to send test email');
    }
    return res.json();
  }
};
