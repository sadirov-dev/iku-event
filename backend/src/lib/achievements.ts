import { query, type Db } from "../db";
import { notifyAchievement } from "./notifications";

/**
 * Awards attendance-based achievements. Safe to call repeatedly — already-earned
 * achievements are skipped by the primary key, so only new ones trigger a notification.
 */
export async function awardAchievements(studentId: number, db: Db) {
  const [stats] = await query<{ attended: number; it_attended: number }>(
    `SELECT COUNT(*) AS attended,
            COUNT(*) FILTER (WHERE c.slug = 'it') AS it_attended
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE r.student_id = $1 AND r.attended`,
    [studentId],
    db,
  );
  if (!stats) return;

  const earned: string[] = [];
  if (stats.attended >= 1) earned.push("FIRST_EVENT");
  if (stats.attended >= 5) earned.push("FIVE_EVENTS");
  if (stats.attended >= 10) earned.push("ACTIVE_STUDENT");
  if (stats.it_attended >= 1) earned.push("IT_PARTICIPANT");
  if (earned.length === 0) return;

  const awarded = await query(
    `WITH ins AS (
       INSERT INTO student_achievements (student_id, achievement_id)
       SELECT $1, id FROM achievements WHERE code = ANY($2::text[])
       ON CONFLICT DO NOTHING
       RETURNING achievement_id
     )
     SELECT a.icon, a.name_ky, a.name_ru, a.name_en FROM achievements a JOIN ins ON ins.achievement_id = a.id`,
    [studentId, earned],
    db,
  );
  for (const a of awarded) await notifyAchievement(studentId, a, db);
}
