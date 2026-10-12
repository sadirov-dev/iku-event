# IKU Events

Единая платформа мероприятий и объявлений кампуса: студент видит, что происходит сегодня,
находит мероприятие, регистрируется в один клик и получает уведомления. Интерфейс и контент —
на кыргызском, русском и английском.

## Стек

| Часть    | Технологии |
|----------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, Axios, i18next |
| Backend  | Bun, Express 5, PostgreSQL (`pg`), Zod, JWT, argon2id (`Bun.password`) |

## Быстрый старт

Требуется: **Bun ≥ 1.3**, **Node ≥ 20**, **PostgreSQL ≥ 14**.

```bash
# 1. База данных
createdb iku_events

# 2. Backend  (http://localhost:4000)
cd backend
cp .env.example .env          # укажите DATABASE_URL и JWT_SECRET
bun install
bun run db:migrate            # создать таблицы
bun run db:seed               # демо-данные (даты считаются от «сегодня»)
bun run dev

# 3. Frontend (http://localhost:5173) — в другом терминале
cd frontend
npm install
npm run dev                   # /api и /uploads проксируются на :4000
```

### Демо-аккаунты (после `db:seed`)

| Роль        | Email              | Пароль          |
|-------------|--------------------|-----------------|
| Студент     | student@iku.kg     | Student123!     |
| Организатор | organizer@iku.kg   | Organizer123!   |
| Админ       | admin@iku.kg       | Admin123!       |

Ещё пять студентов: `student1..5@iku.kg` / `Student123!`.

## Что реализовано

**MVP (раздел 44 ТЗ) — полностью:**
- регистрация, вход, выход (JWT; выход отзывает все токены пользователя);
- главная: hero, «🔥 Сегодня», ближайшие мероприятия, последние объявления, категории;
- `/events`: поиск (название, описание, категория, организатор), фильтры по периоду и категории, сортировка, пагинация; состояние фильтров хранится в URL;
- `/events/:id`: все поля из ТЗ, состояния кнопки «Зарегистрироваться / ✓ Вы зарегистрированы / Регистрация заполнена / Регистрация закрыта / Мероприятие отменено», отмена регистрации;
- форма регистрации (предзаполняется из профиля), защита от двойной регистрации (`UNIQUE(event_id, student_id)` + блокировка строки при последнем месте);
- `/my-events` с вкладками «Предстоящие / Прошедшие / Отменённые»;
- `/announcements` с типами и приоритетом (закреплённые и важные — выше), срок действия, вложения;
- `/profile`: данные, фото, язык, статистика, достижения;
- переключатель KY / RU / EN без перезагрузки; язык сохраняется в профиле (или в `localStorage` для гостей);
- админ-панель `/admin`: дашборд, CRUD мероприятий (с переводами на 3 языка и обложкой), CRUD объявлений, просмотр регистраций с отметкой посещения и экспортом CSV, управление пользователями (роль, блокировка).

**Сверх MVP (из Phase 2):** уведомления (регистрация, изменение времени/места, отмена, важное объявление, напоминание за 1 час), календарь (месяц/неделя/день), роль организатора с workflow статусов (Черновик → На проверке → Опубликовано), достижения за посещение.

**Не реализовано:** QR-регистрация и check-in, сертификаты (таблица есть, выдачи нет), рейтинг/leaderboard, отзывы, отдельная страница `/organizer` (организатор работает в `/admin/events` и видит только свои мероприятия), UI для категорий и мест (есть только API).

## Мультиязычность

- Переводы интерфейса: `frontend/src/locales/{ky,ru,en}/translation.json` — набор ключей во всех трёх файлах одинаковый.
- Контент хранится в полях `*_ky / *_ru / *_en`. Если перевода нет, показывается доступный язык в порядке: выбранный → ru → ky → en (`frontend/src/lib/localize.ts`).
- API возвращает не текст ошибки, а код (`EVENT_FULL`, `ALREADY_REGISTERED`, …), который frontend переводит (`errors.*` в переводах).
- Уведомления сохраняются сразу на трёх языках и показываются на текущем языке пользователя.

## REST API

Все ответы с ошибкой: `{ "error": { "code": "...", "details"?: ... } }`.

| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/api/auth/register`, `/api/auth/login` | все (rate limit) |
| POST | `/api/auth/logout` · GET `/api/auth/me` | авторизованные |
| PATCH | `/api/profile` | авторизованные |
| GET | `/api/events?search&category&period&date&date_from&date_to&venue&status&sort&page&pageSize` | все |
| GET | `/api/events/:id` | все (черновики — только владельцу/админу) |
| POST · PATCH · DELETE | `/api/events[/:id]` | организатор (свои) / админ |
| POST · DELETE | `/api/events/:id/register` | авторизованные |
| GET · PATCH | `/api/events/:id/registrations[/:regId]` | организатор (свои) / админ |
| GET | `/api/my-events?tab=upcoming\|past\|cancelled` | авторизованные |
| GET | `/api/announcements[/:id]` | все |
| POST · PATCH · DELETE | `/api/announcements[/:id]` | админ |
| GET | `/api/notifications`, `/api/notifications/unread-count` | авторизованные |
| PATCH | `/api/notifications/:id/read`, `/api/notifications/read-all` | авторизованные |
| GET · POST · PATCH · DELETE | `/api/categories`, `/api/venues` | чтение — все, запись — админ |
| GET · PATCH | `/api/admin/stats`, `/api/admin/users[/:id]` | админ |
| POST | `/api/uploads?kind=image\|document` | авторизованные (PDF — только персонал) |

`period`: `today`, `tomorrow`, `week`, `month`, `upcoming`, `past`. «Сегодня» считается в часовом поясе `APP_TIMEZONE` (по умолчанию `Asia/Bishkek`).

## Безопасность

- Пароли — argon2id; JWT (HS256) с версией токена: блокировка, смена роли и выход действуют сразу.
- RBAC на каждом маршруте; организатор не может менять чужие мероприятия или публиковать без админа.
- Валидация всех входных данных (Zod) на backend; дублирующая проверка форм на frontend.
- Helmet, CORS по списку `CORS_ORIGIN`, rate limiting на вход/регистрацию и запись на мероприятие.
- Загрузки: тип определяется по сигнатуре файла (не по расширению), лимит 5 МБ, случайные имена, отдача с `CSP: sandbox`.
- Внутренние ошибки и stack trace клиенту не отправляются; секреты — только в `.env`.

## Тесты

Интеграционные тесты API (21 тест: авторизация, RBAC, фильтры, все сценарии регистрации, уведомления):

```bash
cd backend
bun run db:reset && bun test   # ⚠️ db:reset удаляет все данные — только для dev-базы
```

## Структура

```
backend/
  src/
    app.ts, index.ts        # Express-приложение и запуск (+ задача напоминаний)
    config.ts               # переменные окружения
    db/                     # schema.sql, migrate.ts, seed.ts, пул соединений
    middleware/             # auth (JWT, роли), обработка ошибок
    lib/                    # события, уведомления, достижения, валидация
    routes/                 # auth, profile, events, myEvents, announcements, notifications, catalog, admin, uploads
  tests/api.test.ts
frontend/
  src/
    locales/{ky,ru,en}/     # переводы интерфейса
    lib/                    # api-клиент, типы, localize, форматирование дат
    context/AuthContext.tsx
    components/             # Layout (header + мобильная навигация), карточки, модалки, UI-примитивы
    pages/                  # страницы студента
    pages/admin/            # панель управления
```

## Git workflow

`main` ← `develop` ← `feature/*` (например `feature/auth`, `feature/events`, `feature/i18n`), слияние через Pull Request и code review.
# iku-event
