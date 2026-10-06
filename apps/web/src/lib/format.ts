export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function duration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function dueLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (diff < 0)
    return days === 0
      ? 'Due today'
      : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export const DIFFICULTY_LABELS = ['', 'Warm-up', 'Easy', 'Medium', 'Hard', 'Challenge'] as const;
