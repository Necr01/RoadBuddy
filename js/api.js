/* ================================================================
   RoadBuddy — Phase 6: Frontend API Client
   File: js/api.js
   ----------------------------------------------------------------
   Wraps all backend fetch() calls.
   - If the backend is reachable → uses real API
   - If the backend is offline   → falls back gracefully to the
     existing localStorage-based mock (phases 0-5 behavior)
   - Stores the JWT token in localStorage
   - Adds Authorization header to every authenticated request
   ================================================================ */

const RBApi = (() => {

  const BASE      = (window.RB_API_BASE || 'http://localhost:3001') + '/api';
  const TOKEN_KEY = 'rb_token';
  const USER_KEY  = 'rb_current_user';

  /* ── Token helpers ── */
  function getToken()    { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken()  { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

  function getUser()     { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
  function setUser(u)    { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function clearUser()   { localStorage.removeItem(USER_KEY); }

  /* ── Core fetch wrapper ── */
  async function req(method, path, body, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(BASE + path, {
        method,
        headers,
        signal: controller.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { ok: false, status: res.status, message: data.message || `Error ${res.status}`, offline: false };
      }
      return { ok: true, status: res.status, data, offline: false };

    } catch (err) {
      clearTimeout(timer);
      const offline = err.name === 'AbortError' || err.message?.includes('fetch') || err.message?.includes('Network');
      return { ok: false, message: offline ? 'Backend is offline — running in demo mode.' : err.message, offline };
    }
  }

  /* ── Connectivity check ── */
  async function isOnline() {
    const result = await req('GET', '/health', undefined, 2000);
    return result.ok;
  }

  /* ── Logout ── */
  function logout() {
    clearToken();
    clearUser();
  }

  /* ── Auth API ── */
  const auth = {
    async login(email, password, role) {
      const result = await req('POST', '/auth/login', { email, password, role });
      if (result.ok) {
        setToken(result.data.token);
        setUser(result.data.user);
      }
      return result;
    },

    async register(data) {
      const result = await req('POST', '/auth/register', data);
      if (result.ok) {
        setToken(result.data.token);
        setUser(result.data.user);
      }
      return result;
    },

    async adminLogin(email, password) {
      const result = await req('POST', '/auth/admin/login', { email, password });
      if (result.ok) {
        setToken(result.data.token);
        setUser({ ...result.data.user, role: 'admin' });
      }
      return result;
    },

    async adminRegister(data) {
      return req('POST', '/auth/admin/register', data);
    },

    async verifyInviteCode(code) {
      return req('POST', '/admin/verify-invite', { code });
    },

    async me() {
      return req('GET', '/users/me');
    },
  };

  /* ── Providers API ── */
  const providers = {
    nearby: (lat, lng, type) => req('GET', `/providers/nearby?lat=${lat}&lng=${lng}${type ? '&type='+type : ''}`),
    get:    (id)             => req('GET', `/providers/${id}`),
  };

  /* ── Requests API ── */
  const requests = {
    create:       (data)         => req('POST', '/requests', data),
    list:         ()             => req('GET',  '/requests'),
    get:          (id)           => req('GET',  `/requests/${id}`),
    updateStatus: (id, status)   => req('PUT',  `/requests/${id}/status`, { status }),
  };

  /* ── Messages API ── */
  const messages = {
    get:    (requestId)          => req('GET',  `/messages/${requestId}`),
    send:   (requestId, content) => req('POST', `/messages/${requestId}`, { content }),
    unread: (requestId)          => req('GET',  `/messages/${requestId}/unread`),
  };

  /* ── Reviews API ── */
  const reviews = {
    submit:      (data)       => req('POST', '/reviews', data),
    forProvider: (providerId) => req('GET',  `/reviews/provider/${providerId}`),
  };

  /* ── Admin API ── */
  const admin = {
    users:     ()       => req('GET',  '/admin/users'),
    providers: ()       => req('GET',  '/admin/providers'),
    approve:   (id)     => req('POST', `/admin/providers/${id}/approve`),
    reject:    (id)     => req('POST', `/admin/providers/${id}/reject`),
    suspend:   (id)     => req('POST', `/admin/providers/${id}/suspend`),
    requests:  (status) => req('GET',  `/admin/requests${status ? '?status='+status : ''}`),
    reviews:   ()       => req('GET',  '/admin/reviews'),
    flagReview: (id)    => req('PATCH',`/admin/reviews/${id}/flag`),
    analytics: ()       => req('GET',  '/admin/analytics'),
    auditLog:  ()       => req('GET',  '/admin/audit-log'),
    admins:    ()       => req('GET',  '/admin/admins'),
    settings: {
      get:  ()     => req('GET', '/admin/settings'),
      save: (data) => req('PUT', '/admin/settings', { settings: data }),
    },
  };

  return {
    isOnline, logout,
    getToken, setToken, clearToken,
    getUser, setUser, clearUser,
    auth, providers, requests, messages, reviews, admin,
  };
})();
