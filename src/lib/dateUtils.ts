/**
 * Returns today's date in YYYY-MM-DD format using America/Manaus timezone (UTC-4).
 * NEVER use toISOString() for local dates — it converts back to UTC and shifts the day.
 */
export function getHojeManaus(): string {
  const now = new Date();
  // Get components in Manaus timezone
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  // en-CA already returns YYYY-MM-DD format
  return parts;
}
