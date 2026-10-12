import { query, type Db, pool } from "../db";

type NotificationType =
  | "REGISTRATION"
  | "REMINDER"
  | "EVENT_CHANGED"
  | "VENUE_CHANGED"
  | "EVENT_CANCELLED"
  | "ANNOUNCEMENT"
  | "ACHIEVEMENT";

type Localized = { ky: string; ru: string; en: string };

interface EventTitles {
  title_ky: string | null;
  title_ru: string | null;
  title_en: string | null;
}

/** Same fallback rule as the frontend: requested language → Russian → Kyrgyz → English. */
function pick(titles: EventTitles, lang: "ky" | "ru" | "en"): string {
  return titles[`title_${lang}`] ?? titles.title_ru ?? titles.title_ky ?? titles.title_en ?? "";
}

/** Notifications are stored in all three languages so they render in whatever language the user picks later. */
const templates: Record<
  Exclude<NotificationType, "ANNOUNCEMENT" | "ACHIEVEMENT">,
  { title: Localized; message: (t: Localized) => Localized }
> = {
  REGISTRATION: {
    title: { ky: "Каттоо ырасталды", ru: "Регистрация подтверждена", en: "Registration confirmed" },
    message: (t) => ({
      ky: `Сиз «${t.ky}» иш-чарасына катталдыңыз.`,
      ru: `Вы зарегистрированы на «${t.ru}».`,
      en: `You are registered for “${t.en}”.`,
    }),
  },
  REMINDER: {
    title: { ky: "Эскертме", ru: "Напоминание", en: "Reminder" },
    message: (t) => ({
      ky: `«${t.ky}» 1 сааттан кийин башталат.`,
      ru: `«${t.ru}» начнётся через 1 час.`,
      en: `“${t.en}” starts in 1 hour.`,
    }),
  },
  EVENT_CHANGED: {
    title: { ky: "Убакыт өзгөрдү", ru: "Время изменено", en: "Time changed" },
    message: (t) => ({
      ky: `«${t.ky}» иш-чарасынын убактысы өзгөртүлдү.`,
      ru: `Время мероприятия «${t.ru}» было изменено.`,
      en: `The time of “${t.en}” has been changed.`,
    }),
  },
  VENUE_CHANGED: {
    title: { ky: "Өтүүчү жер өзгөрдү", ru: "Место изменено", en: "Venue changed" },
    message: (t) => ({
      ky: `«${t.ky}» иш-чарасынын өтүүчү жери өзгөртүлдү.`,
      ru: `Место проведения «${t.ru}» было изменено.`,
      en: `The venue of “${t.en}” has been changed.`,
    }),
  },
  EVENT_CANCELLED: {
    title: { ky: "Иш-чара жокко чыгарылды", ru: "Мероприятие отменено", en: "Event cancelled" },
    message: (t) => ({
      ky: `«${t.ky}» иш-чарасы жокко чыгарылды.`,
      ru: `Мероприятие «${t.ru}» было отменено.`,
      en: `“${t.en}” has been cancelled.`,
    }),
  },
};

const titlesFor = (e: EventTitles): Localized => ({ ky: pick(e, "ky"), ru: pick(e, "ru"), en: pick(e, "en") });

async function insert(
  db: Db,
  userIds: number[],
  type: NotificationType,
  title: Localized,
  message: Localized,
  link: string | null,
) {
  if (userIds.length === 0) return;
  await query(
    `INSERT INTO notifications (user_id, type, title_ky, title_ru, title_en, message_ky, message_ru, message_en, link)
     SELECT unnest($1::int[]), $2, $3, $4, $5, $6, $7, $8, $9`,
    [userIds, type, title.ky, title.ru, title.en, message.ky, message.ru, message.en, link],
    db,
  );
}

export async function notifyEvent(
  type: keyof typeof templates,
  event: EventTitles & { id: number },
  userIds: number[],
  db: Db = pool,
) {
  const tpl = templates[type];
  await insert(db, userIds, type, tpl.title, tpl.message(titlesFor(event)), `/events/${event.id}`);
}

/** Notify every confirmed participant of an event. */
export async function notifyParticipants(
  type: keyof typeof templates,
  event: EventTitles & { id: number },
  db: Db = pool,
) {
  const rows = await query<{ student_id: number }>(
    `SELECT student_id FROM registrations WHERE event_id = $1 AND status = 'CONFIRMED'`,
    [event.id],
    db,
  );
  await notifyEvent(type, event, rows.map((r) => r.student_id), db);
}

export async function notifyAnnouncement(announcement: EventTitles & { id: number }, db: Db = pool) {
  const students = await query<{ id: number }>(
    `SELECT id FROM users WHERE role = 'STUDENT' AND is_blocked = FALSE`,
    [],
    db,
  );
  await insert(
    db,
    students.map((s) => s.id),
    "ANNOUNCEMENT",
    { ky: "Жаңы маанилүү кулактандыруу", ru: "Новое важное объявление", en: "New important announcement" },
    titlesFor(announcement),
    `/announcements/${announcement.id}`,
  );
}

export async function notifyAchievement(
  userId: number,
  achievement: { name_ky: string | null; name_ru: string | null; name_en: string | null; icon: string | null },
  db: Db = pool,
) {
  const n = { title_ky: achievement.name_ky, title_ru: achievement.name_ru, title_en: achievement.name_en };
  const t = titlesFor(n);
  const icon = achievement.icon ? `${achievement.icon} ` : "";
  await insert(
    db,
    [userId],
    "ACHIEVEMENT",
    { ky: "Жаңы жетишкендик!", ru: "Новое достижение!", en: "New achievement!" },
    { ky: `${icon}${t.ky}`, ru: `${icon}${t.ru}`, en: `${icon}${t.en}` },
    "/profile",
  );
}

/** Sends "starts in 1 hour" reminders. Runs on an interval from index.ts. */
export async function sendDueReminders() {
  const due = await query<EventTitles & { id: number }>(
    `UPDATE events SET reminder_sent = TRUE
     WHERE status = 'PUBLISHED' AND reminder_sent = FALSE
       AND (date + start_time) BETWEEN LOCALTIMESTAMP AND LOCALTIMESTAMP + INTERVAL '1 hour'
     RETURNING id, title_ky, title_ru, title_en`,
  );
  for (const event of due) await notifyParticipants("REMINDER", event);
}
