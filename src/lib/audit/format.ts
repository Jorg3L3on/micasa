/**
 * Time copy for Actividad (Mexico City). Days go through calendar-dates; the
 * time of day and "hace 5 min" use Intl with the app time zone.
 */
import { APP_TIMEZONE, formatCalendarDate, formatDisplayDate, todayCalendarDate, yesterdayCalendarDate } from '@/lib/calendar-dates';

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const relativeFormatter = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

/** Civil day (Mexico City) of an ISO instant. */
export const auditDay = (iso: string): string => formatCalendarDate(new Date(iso));

/** "Hoy", "Ayer" or "31 may" / "31 may 2025". */
export const formatAuditDayHeading = (iso: string, now: Date = new Date()): string => {
  const day = auditDay(iso);
  if (day === todayCalendarDate(now)) return 'Hoy';
  if (day === yesterdayCalendarDate(now)) return 'Ayer';
  return formatDisplayDate(day, now);
};

/** "14:05". */
export const formatAuditTime = (iso: string): string => timeFormatter.format(new Date(iso));

/** "hace 5 minutos", "hace 3 horas", then the day and time. */
export const formatAuditRelative = (iso: string, now: Date = new Date()): string => {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute');
  if (abs < 6 * 3600) return relativeFormatter.format(Math.round(seconds / 3600), 'hour');
  return `${formatAuditDayHeading(iso, now)} · ${formatAuditTime(iso)}`;
};
