-- IKU Events — database schema (idempotent; safe to run repeatedly)

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'ORGANIZER', 'ADMIN')),
  is_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
  language       TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ky', 'ru', 'en')),
  avatar         TEXT,
  token_version  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_code  TEXT,
  group_name    TEXT,
  faculty       TEXT,
  phone         TEXT
);

CREATE TABLE IF NOT EXISTS organizer_profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization  TEXT,
  phone         TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name_ky     TEXT,
  name_ru     TEXT,
  name_en     TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS venues (
  id        SERIAL PRIMARY KEY,
  name_ky   TEXT,
  name_ru   TEXT,
  name_en   TEXT,
  building  TEXT,
  floor     TEXT,
  room      TEXT,
  capacity  INTEGER CHECK (capacity IS NULL OR capacity > 0)
);

CREATE TABLE IF NOT EXISTS events (
  id                     SERIAL PRIMARY KEY,
  title_ky               TEXT,
  title_ru               TEXT,
  title_en               TEXT,
  description_ky         TEXT,
  description_ru         TEXT,
  description_en         TEXT,
  image                  TEXT,
  category_id            INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  organizer_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  venue_id               INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  date                   DATE NOT NULL,
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL,
  capacity               INTEGER CHECK (capacity IS NULL OR capacity > 0),
  registration_deadline  TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED', 'COMPLETED', 'CANCELLED')),
  requirements_ky        TEXT,
  requirements_ru        TEXT,
  requirements_en        TEXT,
  program_ky             TEXT,
  program_ru             TEXT,
  program_en             TEXT,
  contact                TEXT,
  reminder_sent          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time),
  CHECK (COALESCE(title_ky, title_ru, title_en) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS events_date_idx ON events (date, start_time);
CREATE INDEX IF NOT EXISTS events_status_idx ON events (status);
CREATE INDEX IF NOT EXISTS events_category_idx ON events (category_id);
CREATE INDEX IF NOT EXISTS events_organizer_idx ON events (organizer_id);

CREATE TABLE IF NOT EXISTS registrations (
  id             SERIAL PRIMARY KEY,
  event_id       INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'CONFIRMED'
                 CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED')),
  full_name      TEXT NOT NULL,
  student_code   TEXT,
  group_name     TEXT,
  faculty        TEXT,
  email          TEXT NOT NULL,
  phone          TEXT,
  extra_info     TEXT,
  attended       BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at   TIMESTAMPTZ,
  UNIQUE (event_id, student_id)
);
CREATE INDEX IF NOT EXISTS registrations_student_idx ON registrations (student_id);

CREATE TABLE IF NOT EXISTS announcements (
  id            SERIAL PRIMARY KEY,
  title_ky      TEXT,
  title_ru      TEXT,
  title_en      TEXT,
  content_ky    TEXT,
  content_ru    TEXT,
  content_en    TEXT,
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority      TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
  category      TEXT NOT NULL DEFAULT 'GENERAL'
                CHECK (category IN ('IMPORTANT', 'ACADEMIC', 'EVENT', 'GENERAL', 'URGENT')),
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  image         TEXT,
  attachment    TEXT,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (COALESCE(title_ky, title_ru, title_en) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS announcements_published_idx ON announcements (published_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_ky    TEXT,
  title_ru    TEXT,
  title_en    TEXT,
  message_ky  TEXT,
  message_ru  TEXT,
  message_en  TEXT,
  type        TEXT NOT NULL
              CHECK (type IN ('REGISTRATION', 'REMINDER', 'EVENT_CHANGED', 'VENUE_CHANGED',
                              'EVENT_CANCELLED', 'ANNOUNCEMENT', 'ACHIEVEMENT', 'SYSTEM')),
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS achievements (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  icon            TEXT,
  name_ky         TEXT,
  name_ru         TEXT,
  name_en         TEXT,
  description_ky  TEXT,
  description_ru  TEXT,
  description_en  TEXT
);

CREATE TABLE IF NOT EXISTS student_achievements (
  student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  awarded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  file        TEXT,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, event_id)
);

-- The main admin: created from ADMIN_EMAIL / ADMIN_PASSWORD on every start, cannot be blocked or demoted.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_main_admin BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS users_single_main_admin ON users (is_main_admin) WHERE is_main_admin;
