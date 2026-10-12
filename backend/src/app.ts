import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { eventsRouter } from "./routes/events";
import { myEventsRouter } from "./routes/myEvents";
import { announcementsRouter } from "./routes/announcements";
import { notificationsRouter } from "./routes/notifications";
import { categoriesRouter, venuesRouter } from "./routes/catalog";
import { adminRouter } from "./routes/admin";
import { uploadsRouter } from "./routes/uploads";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // correct client IPs for rate limiting behind a reverse proxy
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.corsOrigins, credentials: false }));
app.use(express.json({ limit: "200kb" }));

app.use(
  "/uploads",
  express.static(config.uploadDir, {
    fallthrough: false,
    setHeaders: (res) => res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox"),
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/events", eventsRouter);
app.use("/api/my-events", myEventsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/venues", venuesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/uploads", uploadsRouter);

app.use("/api", notFoundHandler);
app.use(errorHandler);
