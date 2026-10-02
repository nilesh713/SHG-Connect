/* API client – every page talks to the Express REST API through this file. */
(function () {
  const BASE = '/api';

  class ApiError extends Error {
    constructor(message, status, errors) {
      super(message);
      this.status = status;
      this.errors = errors || [];
    }
  }

  async function request(method, path, { body, query, auth = true } = {}) {
    let url = BASE + path;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.append(k, v);
      });
      const qs = params.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const headers = {};
    const token = window.Auth && Auth.getToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    let payload;
    if (body instanceof FormData) {
      payload = body; // browser sets multipart boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, { method, headers, body: payload });
    } catch (e) {
      throw new ApiError(t('err.network'), 0);
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* empty or non-JSON response */
    }

    if (!res.ok || (data && data.success === false)) {
      // Expired / invalid session → clear it so the UI shows the login state
      if (res.status === 401 && token && window.Auth) Auth.clear();
      throw new ApiError((data && data.message) || t('err.generic'), res.status, data && data.errors);
    }
    return data;
  }

  window.ApiError = ApiError;
  window.API = {
    get: (path, query, opts) => request('GET', path, { query, ...opts }),
    post: (path, body, opts) => request('POST', path, { body, ...opts }),
    put: (path, body, opts) => request('PUT', path, { body, ...opts }),
    del: (path, opts) => request('DELETE', path, opts)
  };
})();
