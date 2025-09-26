export const demoUsers = [
  {
    username: 'planificador',
    password: 'planificador',
    role: 'Planificador',
    displayName: 'Planificador principal',
  },
  {
    username: 'logistica',
    password: 'logistica',
    role: 'Logística',
    displayName: 'Equipo logística',
  },
];

export function authenticate(username, password) {
  return (
    demoUsers.find(
      (candidate) =>
        candidate.username.toLowerCase() === username.toLowerCase() &&
        candidate.password === password,
    ) || null
  );
}

export function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(value) {
  if (!value) return '';
  const normalised = value.slice(0, 5);
  return normalised;
}

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}
