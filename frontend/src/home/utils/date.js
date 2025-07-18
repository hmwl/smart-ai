export function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
} 