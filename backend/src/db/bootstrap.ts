/**
 * Runs on every server start (and before demo data). Idempotent: guarantees the data the app
 * cannot work without — reference data from the ТЗ and the three system accounts.
 */
import { query, queryOne, transaction } from "./index";
import { config } from "../config";

// ---------- Reference data (ТЗ §26, §27, §18) ----------

const CATEGORIES = [
  ["it", "IT", "IT", "IT", "💻", "#6366f1"],
  ["education", "Билим берүү", "Образование", "Education", "📚", "#0ea5e9"],
  ["sport", "Спорт", "Спорт", "Sport", "⚽", "#22c55e"],
  ["entertainment", "Көңүл ачуу", "Развлечения", "Entertainment", "🎉", "#ec4899"],
  ["contests", "Сынактар", "Конкурсы", "Contests", "🏆", "#f59e0b"],
  ["festivals", "Фестивалдар", "Фестивали", "Festivals", "🎪", "#f97316"],
  ["culture", "Маданият", "Культура", "Culture", "🎭", "#a855f7"],
  ["career", "Карьера", "Карьера", "Career", "💼", "#14b8a6"],
  ["other", "Башка", "Другое", "Other", "✨", "#64748b"],
];

const VENUES: [string, string, string, string, string, string, number][] = [
  ["Чоң зал", "Главный зал", "Main Hall", "A", "1", "—", 300],
  ["Компьютердик класс", "Компьютерный класс", "Computer Lab", "B", "2", "214", 40],
  ["Спорт аянтчасы", "Спортивная площадка", "Sports Ground", "—", "—", "—", 500],
  ["Конференц-зал", "Конференц-зал", "Conference Hall", "A", "3", "301", 80],
  ["101-кабинет", "Кабинет 101", "Room 101", "A", "1", "101", 30],
];

const ACHIEVEMENTS = [
  ["FIRST_EVENT", "🏆", "Биринчи иш-чара", "Первое мероприятие", "First event", "Биринчи иш-чарага катышты", "Посетил первое мероприятие", "Attended your first event"],
  ["FIVE_EVENTS", "🎯", "5 иш-чара", "5 мероприятий", "5 events", "5 иш-чарага катышты", "Посетил 5 мероприятий", "Attended 5 events"],
  ["ACTIVE_STUDENT", "🔥", "Активдүү студент", "Активный студент", "Active student", "10 иш-чарага катышты", "Посетил 10 мероприятий", "Attended 10 events"],
  ["IT_PARTICIPANT", "💻", "IT-сынактын катышуучусу", "Участник IT-конкурса", "IT contest participant", "IT иш-чарасына катышты", "Принял участие в IT-мероприятии", "Took part in an IT event"],
  ["VOLUNTEER", "🤝", "Волонтёр", "Волонтёр", "Volunteer", "Иш-чараларга жардам берди", "Помогал в организации мероприятий", "Helped organise events"],
];

export async function ensureReferenceData() {
  for (const [i, [slug, ky, ru, en, icon, color]] of CATEGORIES.entries()) {
    await query(
      `INSERT INTO categories (slug, name_ky, name_ru, name_en, icon, color, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (slug) DO NOTHING`,
      [slug, ky, ru, en, icon, color, i],
    );
  }
  for (const a of ACHIEVEMENTS) {
    await query(
      `INSERT INTO achievements (code, icon, name_ky, name_ru, name_en, description_ky, description_ru, description_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING`,
      a,
    );
  }
  // Venues have no natural key, so they are only added to an empty table.
  const venues = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM venues`);
  if (venues?.n === 0) {
    for (const v of VENUES) {
      await query(
        `INSERT INTO venues (name_ky, name_ru, name_en, building, floor, room, capacity) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        v,
      );
    }
  }
}

// ---------- System accounts ----------

type Role = "ADMIN" | "ORGANIZER" | "STUDENT";

interface SystemAccount {
  role: Role;
  email: string;
  /** From the environment; dev-only fallbacks so local setup works out of the box. */
  password: string | undefined;
  fullName: string;
}

const env = process.env;
const devPassword = (value: string) => (config.isProduction ? undefined : value);

export const systemAccounts: Record<"admin" | "organizer" | "student", SystemAccount> = {
  admin: {
    role: "ADMIN",
    email: (env.ADMIN_EMAIL ?? "admin@iku.kg").trim().toLowerCase(),
    password: env.ADMIN_PASSWORD || devPassword("Admin123!"),
    fullName: "Главный администратор",
  },
  organizer: {
    role: "ORGANIZER",
    email: (env.ORGANIZER_EMAIL ?? "organizer@iku.kg").trim().toLowerCase(),
    password: env.ORGANIZER_PASSWORD || devPassword("Organizer123!"),
    fullName: "Бакыт Асанов",
  },
  student: {
    role: "STUDENT",
    email: (env.STUDENT_EMAIL ?? "student@iku.kg").trim().toLowerCase(),
    password: env.STUDENT_PASSWORD || devPassword("Student123!"),
    fullName: "Азамат Токтогулов",
  },
};

/**
 * Creates the account if it is missing and keeps its password equal to the configured one,
 * so the credentials handed out always work. The main admin is also forced back to an
 * unblocked ADMIN; other accounts keep whatever role an admin gave them.
 */
async function ensureAccount(account: SystemAccount, isMainAdmin: boolean): Promise<number | null> {
  const { password } = account;
  if (!password) return null;
  if (password.length < 8) throw new Error(`Password for ${account.email} must be at least 8 characters`);

  return transaction(async (db) => {
    let user = await queryOne(`SELECT id, password_hash FROM users WHERE email = $1 FOR UPDATE`, [account.email], db);

    if (!user) {
      user = await queryOne(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
        [account.email, await Bun.password.hash(password), account.fullName, account.role],
        db,
      );
      if (account.role === "STUDENT") {
        await query(
          `INSERT INTO student_profiles (user_id, student_code, group_name, faculty, phone) VALUES ($1, $2, $3, $4, $5)`,
          [user.id, "IKU-2024-0117", "ПИ-22", "Факультет информационных технологий", "+996 700 123 456"],
          db,
        );
      } else if (account.role === "ORGANIZER") {
        await query(`INSERT INTO organizer_profiles (user_id, organization, phone) VALUES ($1, $2, $3)`, [
          user.id, "Студенческий совет IKU", "+996 555 100 200",
        ], db);
      }
    } else if (!(await Bun.password.verify(password, user.password_hash))) {
      // Password changed in the environment: apply it and sign out old sessions.
      await query(
        `UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = NOW() WHERE id = $1`,
        [user.id, await Bun.password.hash(password)],
        db,
      );
    }

    if (isMainAdmin) {
      await query(`UPDATE users SET is_main_admin = FALSE WHERE is_main_admin AND id <> $1`, [user.id], db);
      await query(
        `UPDATE users SET role = 'ADMIN', is_blocked = FALSE, is_main_admin = TRUE, updated_at = NOW() WHERE id = $1`,
        [user.id],
        db,
      );
    }
    return user.id as number;
  });
}

export async function ensureSystemAccounts() {
  const admin = await ensureAccount(systemAccounts.admin, true);
  if (!admin) console.warn("ADMIN_PASSWORD is not set — the main admin account was not created or updated.");
  const organizer = await ensureAccount(systemAccounts.organizer, false);
  const student = await ensureAccount(systemAccounts.student, false);
  return { admin, organizer, student };
}

export async function bootstrap() {
  await ensureReferenceData();
  return ensureSystemAccounts();
}
