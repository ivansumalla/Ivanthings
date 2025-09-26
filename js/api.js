const API_BASE = 'api';

async function handleResponse(response) {
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
    throw new Error(message);
  }
  return response.json();
}

export async function fetchLoads(filters = {}) {
  const params = new URLSearchParams();
  if (filters.numEnvio) {
    params.set('numEnvio', filters.numEnvio);
  }
  const url = `${API_BASE}/load-list.php${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, { credentials: 'include' });
  return handleResponse(response);
}

export async function saveLoads(loads) {
  const payload = {
    loads: loads.map((load) => ({
      ...load,
      horasPropuestas: Array.isArray(load.horasPropuestas)
        ? load.horasPropuestas
        : typeof load.horasPropuestas === 'string'
        ? load.horasPropuestas
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    })),
  };

  const response = await fetch(`${API_BASE}/save-loads.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

export async function listContacts() {
  const response = await fetch(`${API_BASE}/list-contacts.php`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function upsertContact(type, data) {
  const response = await fetch(`${API_BASE}/save-contact.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ type, ...data }),
  });
  return handleResponse(response);
}

export async function registerResponse(payload) {
  const response = await fetch(`${API_BASE}/register-response.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}
