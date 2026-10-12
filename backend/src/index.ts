import { app } from "./app";
import { config } from "./config";
import { sendDueReminders } from "./lib/notifications";

app.listen(config.port, () => {
  console.log(`IKU Events API listening on http://localhost:${config.port}`);
});

// "Starts in 1 hour" reminders.
const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => sendDueReminders().catch((err) => console.error("Reminder job failed", err)), REMINDER_INTERVAL_MS);
