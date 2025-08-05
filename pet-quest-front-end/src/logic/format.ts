export function formatNanoseconds(nanoseconds: number | undefined): string {
  if (nanoseconds === undefined) return "unknown date"

  const date = new Date(nanoseconds / 1_000_000);

  const day = date.getDate();
  const dayWithSuffix = day + getDaySuffix(day);
  const month = date.toLocaleString('default', { month: 'short' }); // e.g., 'Feb'
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12; // convert to 12-hour format

  return `${dayWithSuffix} ${month} ${year} ${hours}:${minutes}${ampm}`;
}

function getDaySuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}