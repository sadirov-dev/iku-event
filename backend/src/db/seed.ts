/**
 * Development seed data. Dates are relative to "today" so the home page always
 * has something happening today, this week and in the past.
 */
import { pool, query, queryOne } from "./index";
import { config } from "../config";

if (config.isProduction) throw new Error("Refusing to seed a production database");

const existing = await queryOne(`SELECT COUNT(*) AS n FROM users`);
if (existing.n > 0) {
  console.log("Database already has data — run `bun run db:reset` to start fresh.");
  await pool.end();
  process.exit(0);
}

// ---------- Categories ----------
const categories = [
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
const cat: Record<string, number> = {};
for (const [i, [slug, ky, ru, en, icon, color]] of categories.entries()) {
  const row = await queryOne(
    `INSERT INTO categories (slug, name_ky, name_ru, name_en, icon, color, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [slug, ky, ru, en, icon, color, i],
  );
  cat[slug!] = row.id;
}

// ---------- Venues ----------
const venues: [string, string, string, string, string, string, number][] = [
  ["Чоң зал", "Главный зал", "Main Hall", "A", "1", "—", 300],
  ["Компьютердик класс", "Компьютерный класс", "Computer Lab", "B", "2", "214", 40],
  ["Спорт аянтчасы", "Спортивная площадка", "Sports Ground", "—", "—", "—", 500],
  ["Конференц-зал", "Конференц-зал", "Conference Hall", "A", "3", "301", 80],
  ["101-кабинет", "Кабинет 101", "Room 101", "A", "1", "101", 30],
];
const venue: number[] = [];
for (const [ky, ru, en, building, floor, room, capacity] of venues) {
  const row = await queryOne(
    `INSERT INTO venues (name_ky, name_ru, name_en, building, floor, room, capacity) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [ky, ru, en, building, floor, room, capacity],
  );
  venue.push(row.id);
}

// ---------- Achievements ----------
const achievements = [
  ["FIRST_EVENT", "🏆", "Биринчи иш-чара", "Первое мероприятие", "First event", "Биринчи иш-чарага катышты", "Посетил первое мероприятие", "Attended your first event"],
  ["FIVE_EVENTS", "🎯", "5 иш-чара", "5 мероприятий", "5 events", "5 иш-чарага катышты", "Посетил 5 мероприятий", "Attended 5 events"],
  ["ACTIVE_STUDENT", "🔥", "Активдүү студент", "Активный студент", "Active student", "10 иш-чарага катышты", "Посетил 10 мероприятий", "Attended 10 events"],
  ["IT_PARTICIPANT", "💻", "IT-сынактын катышуучусу", "Участник IT-конкурса", "IT contest participant", "IT иш-чарасына катышты", "Принял участие в IT-мероприятии", "Took part in an IT event"],
  ["VOLUNTEER", "🤝", "Волонтёр", "Волонтёр", "Volunteer", "Иш-чараларга жардам берди", "Помогал в организации мероприятий", "Helped organise events"],
];
for (const a of achievements) {
  await query(
    `INSERT INTO achievements (code, icon, name_ky, name_ru, name_en, description_ky, description_ru, description_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    a,
  );
}

// ---------- Users ----------
async function createUser(email: string, password: string, fullName: string, role: string, profile?: string[]) {
  const u = await queryOne(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, await Bun.password.hash(password), fullName, role],
  );
  if (profile) {
    await query(
      `INSERT INTO student_profiles (user_id, student_code, group_name, faculty, phone) VALUES ($1,$2,$3,$4,$5)`,
      [u.id, ...profile],
    );
  }
  return u.id as number;
}

const admin = await createUser("admin@iku.kg", "Admin123!", "Айгуль Сыдыкова", "ADMIN");
const organizer = await createUser("organizer@iku.kg", "Organizer123!", "Бакыт Асанов", "ORGANIZER");
await query(`INSERT INTO organizer_profiles (user_id, organization, phone) VALUES ($1, $2, $3)`, [
  organizer, "Студенческий совет IKU", "+996 555 100 200",
]);
const student = await createUser("student@iku.kg", "Student123!", "Азамат Токтогулов", "STUDENT", [
  "IKU-2024-0117", "ПИ-22", "Факультет информационных технологий", "+996 700 123 456",
]);
const others: number[] = [];
const names = ["Нургуль Абдыкадырова", "Эмир Жумабеков", "Айпери Мамытова", "Тимур Исаков", "Жылдыз Осмонова"];
for (const [i, name] of names.entries()) {
  others.push(
    await createUser(`student${i + 1}@iku.kg`, "Student123!", name, "STUDENT", [
      `IKU-2024-02${i}0`, i % 2 ? "ЭК-21" : "ПИ-23", i % 2 ? "Экономический факультет" : "Факультет информационных технологий", "",
    ]),
  );
}

// ---------- Events ----------
type Seed = {
  t: [string | null, string, string | null];
  d: [string | null, string, string | null];
  cat: string;
  venue: number;
  day: number;
  start: string;
  end: string;
  capacity: number | null;
  status?: string;
  organizer?: number;
  deadlineDays?: number;
  req?: [string | null, string, string | null];
  program?: [string | null, string, string | null];
};

const events: Seed[] = [
  {
    t: ["IT Хакатон 2026", "IT Хакатон 2026", "IT Hackathon 2026"],
    d: [
      "Командалар 6 саат ичинде кампус жашоосун жакшырта турган долбоорду түзүшөт. Мыкты командаларга сыйлыктар!",
      "Команды за 6 часов создают проект, который улучшит жизнь кампуса. Лучшие команды получат призы и стажировки!",
      "Teams have 6 hours to build a project that improves campus life. Prizes and internships for the best teams!",
    ],
    cat: "it", venue: venue[1]!, day: 0, start: "18:00", end: "23:30", capacity: 40,
    req: ["Ноутбук, 2–4 кишиден турган команда", "Ноутбук, команда из 2–4 человек", "Laptop, team of 2–4 people"],
    program: [
      "18:00 — Ачылыш\n18:30 — Иштөө\n23:00 — Презентациялар",
      "18:00 — Открытие\n18:30 — Работа над проектами\n23:00 — Презентации и награждение",
      "18:00 — Opening\n18:30 — Hacking\n23:00 — Demos & awards",
    ],
  },
  {
    t: ["Таланттар кечеси", "Talent Show", "Talent Show"],
    d: [
      "Ырдай аласыңбы, бийлей аласыңбы же стендап айта аласыңбы? Сахна сеники!",
      "Поёшь, танцуешь или читаешь стендап? Сцена — твоя! Приходи выступить или поддержать друзей.",
      "Sing, dance or do stand-up? The stage is yours! Perform or come cheer your friends on.",
    ],
    cat: "entertainment", venue: venue[0]!, day: 0, start: "19:00", end: "22:00", capacity: 250,
  },
  {
    t: ["Англис тили клубу", "Разговорный клуб английского", "English Speaking Club"],
    d: [
      "Эркин баарлашуу аркылуу англис тилин жакшыртыңыз. Бардык деңгээлдер үчүн.",
      "Практика разговорного английского в неформальной обстановке. Подходит для любого уровня.",
      "Practise spoken English in a relaxed setting. All levels welcome.",
    ],
    cat: "education", venue: venue[4]!, day: 1, start: "15:00", end: "16:30", capacity: 20,
  },
  {
    t: ["Математика олимпиадасы", "Олимпиада по математике", "Math Olympiad"],
    d: ["Университеттик математика олимпиадасы.", "Внутривузовская олимпиада по математике.", "University-wide math olympiad."],
    cat: "contests", venue: venue[3]!, day: 2, start: "10:00", end: "13:00", capacity: 60, deadlineDays: -1,
  },
  {
    t: ["Спорт күнү", "Спортивный день", "Sport Day"],
    d: [
      "Футбол, волейбол, эстафета жана башка көптөгөн спорттук мелдештер.",
      "Футбол, волейбол, эстафета и много других соревнований между факультетами.",
      "Football, volleyball, relays and more — faculties compete for the cup.",
    ],
    cat: "sport", venue: venue[2]!, day: 3, start: "10:00", end: "16:00", capacity: null,
  },
  {
    t: [null, "Субботник в парке", null],
    d: [null, "Волонтёрская уборка парка рядом с кампусом. Инвентарь выдадим на месте.", null],
    cat: "other", venue: venue[2]!, day: 4, start: "09:00", end: "12:00", capacity: 50,
  },
  {
    t: ["Карьера жарманкеси", "Ярмарка карьеры", "Career Fair"],
    d: [
      "20дан ашык компания стажировка жана жумуш сунуштайт. Резюмеңизди ала келиңиз!",
      "Более 20 компаний предлагают стажировки и вакансии. Возьмите с собой резюме!",
      "20+ companies offering internships and jobs. Bring your CV!",
    ],
    cat: "career", venue: venue[3]!, day: 5, start: "11:00", end: "17:00", capacity: 300,
  },
  {
    t: ["Футбол: IKU vs КТУ", "Футбол: IKU vs КТУ", "Football: IKU vs KTU"],
    d: ["Достук беттеши.", "Товарищеский матч сборных университетов.", "Friendly match between university teams."],
    cat: "sport", venue: venue[2]!, day: 6, start: "16:00", end: "18:00", capacity: null, status: "CANCELLED",
  },
  {
    t: ["Шахмат турнири", "Шахматный турнир", "Chess Tournament"],
    d: ["Швейцар системасы боюнча турнир.", "Турнир по швейцарской системе, 7 туров.", "Swiss-system tournament, 7 rounds."],
    cat: "contests", venue: venue[4]!, day: 7, start: "14:00", end: "18:00", capacity: 32,
  },
  {
    t: ["Сүрөт тартуу мастер-классы", "Мастер-класс по фотографии", "Photography Masterclass"],
    d: [
      "Смартфон менен кесипкөй сүрөт тартууну үйрөнүңүз.",
      "Научитесь делать профессиональные снимки на смартфон.",
      "Learn to take professional-looking photos with your phone.",
    ],
    cat: "culture", venue: venue[4]!, day: 8, start: "15:00", end: "17:00", capacity: 3,
  },
  {
    t: ["Күзгү фестиваль", "Осенний фестиваль", "Autumn Festival"],
    d: [
      "Улуттук тамактар, музыка, оюндар жана ярмарка — бүт кампус үчүн майрам.",
      "Национальная кухня, музыка, игры и ярмарка — праздник для всего кампуса.",
      "Traditional food, music, games and a fair — a celebration for the whole campus.",
    ],
    cat: "festivals", venue: venue[2]!, day: 9, start: "12:00", end: "20:00", capacity: null,
  },
  {
    t: ["Кыргыз маданиятынын кечеси", "Вечер кыргызской культуры", "Kyrgyz Culture Evening"],
    d: [
      "Комуз, манас айтуу жана улуттук бийлер.",
      "Комуз, сказители «Манаса» и национальные танцы.",
      "Komuz music, Manas storytellers and traditional dance.",
    ],
    cat: "culture", venue: venue[0]!, day: 12, start: "18:00", end: "20:30", capacity: 280,
  },
  {
    t: ["Робототехника боюнча семинар", "Воркшоп по робототехнике", "Robotics Workshop"],
    d: ["Arduino менен биринчи роботуңузду чогултуңуз.", "Соберите своего первого робота на Arduino.", "Build your first Arduino robot."],
    cat: "it", venue: venue[1]!, day: 14, start: "14:00", end: "17:00", capacity: 25, status: "PENDING", organizer,
  },
  {
    t: [null, "Дебаты: ИИ в образовании", "Debate: AI in Education"],
    d: [null, "Черновик — описание в работе.", "Draft — description in progress."],
    cat: "education", venue: venue[3]!, day: 20, start: "16:00", end: "18:00", capacity: 60, status: "DRAFT", organizer,
  },
  {
    t: ["Кош келиңиз күнү", "День первокурсника", "Welcome Day"],
    d: [
      "Биринчи курстун студенттери үчүн тааныштыруу күнү.",
      "День знакомства с университетом для первокурсников.",
      "Orientation day for first-year students.",
    ],
    cat: "festivals", venue: venue[0]!, day: -10, start: "10:00", end: "14:00", capacity: 300, status: "COMPLETED",
  },
  {
    t: ["Python боюнча интенсив", "Интенсив по Python", "Python Bootcamp"],
    d: ["Бир күндүк интенсив.", "Однодневный интенсив для начинающих.", "One-day beginner bootcamp."],
    cat: "it", venue: venue[1]!, day: -4, start: "10:00", end: "17:00", capacity: 40, status: "COMPLETED",
  },
];

const eventIds: number[] = [];
for (const e of events) {
  const row = await queryOne(
    `INSERT INTO events (title_ky, title_ru, title_en, description_ky, description_ru, description_en,
                         category_id, venue_id, organizer_id, date, start_time, end_time, capacity, status,
                         registration_deadline, requirements_ky, requirements_ru, requirements_en,
                         program_ky, program_ru, program_en, contact)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE + $10::int, $11, $12, $13, $14,
             CASE WHEN $15::int IS NULL THEN NULL ELSE (CURRENT_DATE + $15::int)::timestamp + TIME '23:59' END,
             $16,$17,$18,$19,$20,$21,$22)
     RETURNING id`,
    [
      ...e.t, ...e.d, cat[e.cat], e.venue, e.organizer ?? admin, e.day, e.start, e.end, e.capacity,
      e.status ?? "PUBLISHED", e.deadlineDays ?? null,
      ...(e.req ?? [null, null, null]), ...(e.program ?? [null, null, null]),
      "students@iku.kg · +996 555 100 200",
    ],
  );
  eventIds.push(row.id);
}

const byTitle = (en: string) => eventIds[events.findIndex((e) => e.t[2] === en || e.t[1] === en)]!;

// ---------- Registrations ----------
async function register(eventId: number, userId: number, attended = false, status = "CONFIRMED") {
  const u = await queryOne(
    `SELECT u.full_name, u.email, sp.student_code, sp.group_name, sp.faculty FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
    [userId],
  );
  await query(
    `INSERT INTO registrations (event_id, student_id, full_name, email, student_code, group_name, faculty, attended, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [eventId, userId, u.full_name, u.email, u.student_code ?? "—", u.group_name ?? "—", u.faculty, attended, status],
  );
}

await register(byTitle("IT Hackathon 2026"), student);
await register(byTitle("Career Fair"), student);
await register(byTitle("Football: IKU vs KTU"), student);
await register(byTitle("Welcome Day"), student, true);
await register(byTitle("Python Bootcamp"), student, true);
for (const [i, id] of others.entries()) {
  await register(byTitle("IT Hackathon 2026"), id);
  await register(byTitle("Welcome Day"), id, i < 3); // not everyone who registers shows up
}
for (const id of others.slice(0, 3)) await register(byTitle("Photography Masterclass"), id);
for (const id of others.slice(0, 4)) await register(byTitle("English Speaking Club"), id);

await query(
  `INSERT INTO student_achievements (student_id, achievement_id)
   SELECT $1, id FROM achievements WHERE code IN ('FIRST_EVENT', 'IT_PARTICIPANT')`,
  [student],
);

// ---------- Announcements ----------
const announcements: [string, string, string, string, string, string, string, string, boolean, number | null][] = [
  [
    "Сессиянын жүгүртмөсү жарыяланды", "Опубликовано расписание сессии", "Exam schedule published",
    "Кышкы сессиянын жүгүртмөсү деканаттын сайтында жана маалымат тактасында жеткиликтүү.",
    "Расписание зимней сессии доступно на сайте деканата и на информационном стенде в корпусе А.",
    "The winter exam schedule is available on the dean's office website and on the notice board in building A.",
    "ACADEMIC", "HIGH", true, null,
  ],
  [
    "Шашылыш: эртең сабактар онлайн өтөт", "Срочно: завтра занятия проходят онлайн", "Urgent: classes are online tomorrow",
    "Жылуулук тармагындагы оңдоо иштерине байланыштуу эртең бардык сабактар онлайн форматта өтөт.",
    "В связи с ремонтом теплосети завтра все занятия проходят в онлайн-формате. Ссылки — у кураторов.",
    "Due to heating repairs, all classes tomorrow will be held online. Ask your curator for links.",
    "URGENT", "HIGH", false, 2,
  ],
  [
    "Хакатонго каттоо ачык", "Открыта регистрация на хакатон", "Hackathon registration is open",
    "IT Хакатон 2026га катталууга шашылыңыз — орундар чектелүү!",
    "Успейте зарегистрироваться на IT Хакатон 2026 — количество мест ограничено!",
    "Register for IT Hackathon 2026 — places are limited!",
    "EVENT", "NORMAL", false, null,
  ],
  [
    "Китепкананын жаңы иш убактысы", "Новый график работы библиотеки", "New library opening hours",
    "Китепкана эми дүйшөмбүдөн ишембиге чейин 08:00–20:00 иштейт.",
    "Библиотека теперь работает с понедельника по субботу с 08:00 до 20:00.",
    "The library is now open Monday to Saturday, 08:00–20:00.",
    "GENERAL", "NORMAL", false, null,
  ],
  [
    "Стипендия боюнча документтер", "Документы на стипендию", "Scholarship documents",
    "Стипендияга документтерди 15-октябрга чейин тапшыруу керек.",
    "Документы на повышенную стипендию принимаются до 15 октября в кабинете 105.",
    "Applications for the merit scholarship are accepted until 15 October in room 105.",
    "IMPORTANT", "HIGH", false, null,
  ],
];
for (const [i, a] of announcements.entries()) {
  const [tky, tru, ten, cky, cru, cen, category, priority, pinned, expiresDays] = a;
  await query(
    `INSERT INTO announcements (title_ky, title_ru, title_en, content_ky, content_ru, content_en, category, priority,
                                is_pinned, author_id, published_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() - make_interval(hours => $11::int),
             CASE WHEN $12::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $12::int) END)`,
    [tky, tru, ten, cky, cru, cen, category, priority, pinned, admin, i * 20, expiresDays],
  );
}

// ---------- Notifications ----------
await query(
  `INSERT INTO notifications (user_id, type, title_ky, title_ru, title_en, message_ky, message_ru, message_en, link, is_read, created_at)
   VALUES
   ($1, 'REGISTRATION', 'Каттоо ырасталды', 'Регистрация подтверждена', 'Registration confirmed',
        'Сиз «IT Хакатон 2026» иш-чарасына катталдыңыз.', 'Вы зарегистрированы на «IT Хакатон 2026».',
        'You are registered for “IT Hackathon 2026”.', '/events/' || $2, FALSE, NOW() - INTERVAL '2 hours'),
   ($1, 'EVENT_CANCELLED', 'Иш-чара жокко чыгарылды', 'Мероприятие отменено', 'Event cancelled',
        '«Футбол: IKU vs КТУ» иш-чарасы жокко чыгарылды.', 'Мероприятие «Футбол: IKU vs КТУ» было отменено.',
        '“Football: IKU vs KTU” has been cancelled.', '/events/' || $3, FALSE, NOW() - INTERVAL '1 day'),
   ($1, 'ACHIEVEMENT', 'Жаңы жетишкендик!', 'Новое достижение!', 'New achievement!',
        '🏆 Биринчи иш-чара', '🏆 Первое мероприятие', '🏆 First event', '/profile', TRUE, NOW() - INTERVAL '10 days')`,
  [student, byTitle("IT Hackathon 2026"), byTitle("Football: IKU vs KTU")],
);

console.log(`Seeded:
  admin@iku.kg      / Admin123!
  organizer@iku.kg  / Organizer123!
  student@iku.kg    / Student123!   (also student1..5@iku.kg)`);
await pool.end();
