// Fechas siempre en formato dd/mm/yyyy en toda la app.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formatea una fecha a dd/mm/yyyy.
 * Acepta 'YYYY-MM-DD', timestamps ISO completos, objetos Date, null o undefined.
 * Para strings, se parsea manualmente la parte de fecha (sin pasar por Date) para
 * evitar el desfase de un día que provoca la conversión UTC->local.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '—';
    return `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;
  }

  const datePart = value.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return String(value);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/**
 * Formatea una fecha con hora a dd/mm/yyyy hh:mm, usando la hora local del navegador.
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const dateObj = value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj.getTime())) return String(value);
  return `${pad2(dateObj.getDate())}/${pad2(dateObj.getMonth() + 1)}/${dateObj.getFullYear()} ${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
}
