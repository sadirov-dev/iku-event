import type { AuthUser } from "../middleware/auth";

export const EVENT_STATUSES = ["DRAFT", "PENDING", "APPROVED", "PUBLISHED", "COMPLETED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Statuses anyone (including anonymous visitors) may see. */
export const PUBLIC_STATUSES: EventStatus[] = ["PUBLISHED", "COMPLETED", "CANCELLED"];

export type RegistrationState = "OPEN" | "FULL" | "CLOSED" | "ENDED" | "CANCELLED";

/**
 * Base SELECT for events. `userParam` is the placeholder holding the current user id
 * (or NULL for anonymous) so `my_registration` can be resolved in the same query.
 */
export const eventSelect = (userParam = "$1") => `
  SELECT e.id, e.title_ky, e.title_ru, e.title_en,
         e.description_ky, e.description_ru, e.description_en,
         e.image, e.date, to_char(e.start_time, 'HH24:MI') AS start_time, to_char(e.end_time, 'HH24:MI') AS end_time,
         e.capacity, e.registration_deadline, e.status,
         e.requirements_ky, e.requirements_ru, e.requirements_en,
         e.program_ky, e.program_ru, e.program_en,
         e.contact, e.category_id, e.venue_id, e.organizer_id, e.created_at, e.updated_at,
         CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object(
           'id', c.id, 'slug', c.slug, 'name_ky', c.name_ky, 'name_ru', c.name_ru, 'name_en', c.name_en,
           'icon', c.icon, 'color', c.color) END AS category,
         CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object(
           'id', v.id, 'name_ky', v.name_ky, 'name_ru', v.name_ru, 'name_en', v.name_en,
           'building', v.building, 'floor', v.floor, 'room', v.room, 'capacity', v.capacity) END AS venue,
         CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object('id', o.id, 'full_name', o.full_name) END AS organizer,
         (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'CONFIRMED') AS registered_count,
         (SELECT r.status FROM registrations r WHERE r.event_id = e.id AND r.student_id = ${userParam}::int) AS my_registration,
         (SELECT r.attended FROM registrations r WHERE r.event_id = e.id AND r.student_id = ${userParam}::int) AS my_attended,
         (e.date + e.end_time) < LOCALTIMESTAMP AS is_past,
         (e.date + e.start_time) <= LOCALTIMESTAMP AS has_started,
         COALESCE(e.registration_deadline < NOW(), FALSE) AS deadline_passed
  FROM events e
  LEFT JOIN categories c ON c.id = e.category_id
  LEFT JOIN venues v ON v.id = e.venue_id
  LEFT JOIN users o ON o.id = e.organizer_id
`;

export interface EventRow {
  id: number;
  title_ky: string | null;
  title_ru: string | null;
  title_en: string | null;
  date: string;
  start_time: string;
  end_time: string;
  venue_id: number | null;
  status: EventStatus;
  capacity: number | null;
  registered_count: number;
  organizer_id: number | null;
  is_past: boolean;
  has_started: boolean;
  deadline_passed: boolean;
  [key: string]: unknown;
}

export function registrationState(e: EventRow): RegistrationState {
  if (e.status === "CANCELLED") return "CANCELLED";
  if (e.status === "COMPLETED" || e.is_past) return "ENDED";
  if (e.status !== "PUBLISHED" || e.has_started || e.deadline_passed) return "CLOSED";
  if (e.capacity !== null && e.registered_count >= e.capacity) return "FULL";
  return "OPEN";
}

/** Adds derived fields the UI needs and strips internal flags. */
export function serializeEvent(e: EventRow) {
  const { has_started, deadline_passed, ...rest } = e;
  return {
    ...rest,
    seats_left: e.capacity === null ? null : Math.max(0, e.capacity - e.registered_count),
    registration_state: registrationState(e),
  };
}

export function canManageEvent(user: AuthUser | undefined, e: { organizer_id: number | null }) {
  if (!user) return false;
  return user.role === "ADMIN" || (user.role === "ORGANIZER" && e.organizer_id === user.id);
}

/** Whether `user` may see this event at all (drafts are hidden from the public). */
export function canViewEvent(user: AuthUser | undefined, e: EventRow) {
  return PUBLIC_STATUSES.includes(e.status) || canManageEvent(user, e);
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
