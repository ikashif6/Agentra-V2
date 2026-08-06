import { env } from "../config/env.js";

function fromHeader(): string {
  const email = env.resendFromEmail || env.emailFrom || "noreply@agentraa.com";
  const name = (env.resendFromName || "Agentra").trim();
  return name ? `${name} <${email}>` : email;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; loggedOnly?: boolean; error?: string }> {
  const to = String(input.to || "").trim();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "A valid email is required." };
  }

  if (env.resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromHeader(),
          to: [to],
          subject: input.subject,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Email send failed (${res.status}): ${body.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Email send failed.",
      };
    }
  }

  // SMTP_* is reserved for a future mailer; without RESEND, log so local OTP testing works.
  if (env.smtpHost) {
    console.warn(
      "[email] SMTP_HOST is set but sending uses RESEND_API_KEY when available; logging this message instead.",
    );
  }

  console.info(
    `[email:dev] to=${to} subject=${JSON.stringify(input.subject)}\n${input.text}`,
  );
  return { ok: true, loggedOnly: true };
}
