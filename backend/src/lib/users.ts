import { queryOne, query } from "../db";

/** Public shape of the current user, including the student profile and activity stats. */
export async function getUserProfile(userId: number) {
  const user = await queryOne(
    `SELECT u.id, u.email, u.full_name, u.role, u.language, u.avatar, u.created_at,
            sp.student_code, sp.group_name, sp.faculty, sp.phone
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  if (!user) return null;

  const stats = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id
         WHERE r.student_id = $1 AND r.status = 'CONFIRMED' AND e.status <> 'CANCELLED') AS registered,
       (SELECT COUNT(*) FROM registrations WHERE student_id = $1 AND attended) AS attended,
       (SELECT COUNT(*) FROM certificates WHERE student_id = $1) AS certificates,
       (SELECT COUNT(*) FROM student_achievements WHERE student_id = $1) AS achievements`,
    [userId],
  );
  const achievements = await query(
    `SELECT a.code, a.icon, a.name_ky, a.name_ru, a.name_en,
            a.description_ky, a.description_ru, a.description_en, sa.awarded_at
     FROM student_achievements sa JOIN achievements a ON a.id = sa.achievement_id
     WHERE sa.student_id = $1 ORDER BY sa.awarded_at`,
    [userId],
  );

  return { ...user, stats, achievements };
}
