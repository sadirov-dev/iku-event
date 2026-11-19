import { useState, type FormEvent } from "react";
import QRCode from "react-qr-code";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import {
  api,
  errorMessage,
  fieldErrors,
  type RegistrationForm,
} from "../lib/api";
import type { EventItem } from "../lib/types";
import { useLocalize } from "../lib/localize";
import { Alert, Field, Modal, Spinner, cn } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterModal({
  event,
  open,
  onClose,
}: {
  event: EventItem;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const L = useLocalize();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Pre-fill from the profile so returning students only press one button.
  const [form, setForm] = useState<RegistrationForm>(() => ({
    full_name: user?.full_name ?? "",
    student_code: user?.student_code ?? "",
    group_name: user?.group_name ?? "",
    faculty: user?.faculty ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    extra_info: "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => api.registerForEvent(event.id, form),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["event", String(event.id)],
        (old: EventItem | undefined) => ({ ...old, ...updated }),
      );
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["my-events"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => setErrors(fieldErrors(err)),
  });

  const set =
    (k: keyof RegistrationForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const ticketCode =
    `${event.id}-${(user?.id ?? form.student_code).toString().trim() || "guest"}-${event.date}`
      .replace(/\s+/g, "")
      .toUpperCase();
  const ticketValue = JSON.stringify({
    eventId: event.id,
    event: L(event, "title"),
    guest: form.full_name,
    studentCode: form.student_code,
    date: event.date,
    venue: event.venue ? L(event.venue, "name") : "—",
    code: ticketCode,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.full_name.trim().length < 2) errs.full_name = t("errors.required");
    if (!form.student_code.trim()) errs.student_code = t("errors.required");
    if (!form.group_name.trim()) errs.group_name = t("errors.required");
    if (!EMAIL_RE.test(form.email.trim())) errs.email = t("errors.email");
    setErrors(errs);
    if (Object.keys(errs).length === 0) mutation.mutate();
  };

  const input = (
    k: keyof RegistrationForm,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <input
      id={`reg-${k}`}
      className={cn("input", errors[k] && "input-error")}
      value={form[k] ?? ""}
      onChange={set(k)}
      disabled={mutation.isPending}
      {...props}
    />
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mutation.isSuccess ? t("regForm.success") : t("regForm.title")}
    >
      {mutation.isSuccess ? (
        <div className="space-y-4 text-center">
          <div className="mb-2 text-5xl">🎉</div>
          <p className="font-semibold text-slate-900">{L(event, "title")}</p>
          <p className="text-sm text-slate-600">{t("regForm.successHint")}</p>

          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-left">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
                {t("regForm.ticketTitle")}
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">
                {ticketCode}
              </span>
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="rounded-2xl bg-white p-2 shadow-sm">
                <QRCode
                  value={ticketValue}
                  size={116}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>

              <div className="flex-1 space-y-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-400">
                    {t("regForm.ticketEvent")}:
                  </span>{" "}
                  <span className="font-semibold text-slate-900">
                    {L(event, "title")}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-400">
                    {t("regForm.ticketGuest")}:
                  </span>{" "}
                  <span className="font-semibold text-slate-900">
                    {form.full_name}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-400">
                    {t("regForm.ticketDate")}:
                  </span>{" "}
                  <span className="font-semibold text-slate-900">
                    {event.date}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-400">
                    {t("regForm.ticketVenue")}:
                  </span>{" "}
                  <span className="font-semibold text-slate-900">
                    {event.venue ? L(event.venue, "name") : "—"}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs font-medium text-brand-700">
              {t("regForm.ticketScan")}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="btn-secondary" onClick={onClose}>
              {t("common.close")}
            </button>
            <Link to="/my-events" className="btn-primary">
              {t("regForm.goToMyEvents")}
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="-mt-2 text-sm font-medium text-brand-700">
            {L(event, "title")}
          </p>
          {mutation.isError && <Alert>{errorMessage(mutation.error, t)}</Alert>}
          <Field
            label={`${t("regForm.fullName")} *`}
            error={errors.full_name}
            htmlFor="reg-full_name"
          >
            {input("full_name", { autoComplete: "name", required: true })}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={`${t("regForm.studentId")} *`}
              error={errors.student_code}
              htmlFor="reg-student_code"
            >
              {input("student_code", { required: true })}
            </Field>
            <Field
              label={`${t("regForm.group")} *`}
              error={errors.group_name}
              htmlFor="reg-group_name"
            >
              {input("group_name", { required: true })}
            </Field>
          </div>
          <Field
            label={t("regForm.faculty")}
            error={errors.faculty}
            htmlFor="reg-faculty"
          >
            {input("faculty")}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={`${t("regForm.email")} *`}
              error={errors.email}
              htmlFor="reg-email"
            >
              {input("email", {
                type: "email",
                autoComplete: "email",
                required: true,
              })}
            </Field>
            <Field
              label={t("regForm.phone")}
              error={errors.phone}
              htmlFor="reg-phone"
            >
              {input("phone", { type: "tel", autoComplete: "tel" })}
            </Field>
          </div>
          <Field
            label={t("regForm.extra")}
            error={errors.extra_info}
            htmlFor="reg-extra_info"
          >
            <textarea
              id="reg-extra_info"
              className="input min-h-20"
              placeholder={t("regForm.extraPlaceholder")}
              value={form.extra_info}
              onChange={set("extra_info")}
              disabled={mutation.isPending}
              maxLength={1000}
            />
          </Field>
          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Spinner /> {t("regForm.submitting")}
              </>
            ) : (
              t("regForm.submit")
            )}
          </button>
        </form>
      )}
    </Modal>
  );
}
