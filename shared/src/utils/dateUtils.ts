/** Format a Date to YYYY-MM-DD string using local timezone */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a YYYY-MM-DD string as local-timezone Date (avoids UTC pitfall) */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}
