import { NextResponse } from "next/server";
import { Resend } from "resend";

const FROM_EMAIL = "M.H Detailz <no-reply@mhdetailz.site>";
const ADMIN_EMAIL = process.env.BOOKING_ADMIN_EMAIL ?? "mhdetailz6@gmail.com";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  inquiry_type?: string;
  reply_method?: string;
  message?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRows(payload: Required<ContactPayload>) {
  const rows = [
    ["Name", payload.name],
    ["Email", payload.email],
    ["Phone", payload.phone || "Not provided"],
    ["Inquiry Type", payload.inquiry_type],
    ["Preferred Reply Method", payload.reply_method],
    ["Subject", payload.subject],
    ["Message", payload.message],
  ];

  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e6ebf2;color:#55657d;font-weight:700;">${label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e6ebf2;color:#132036;">${escapeHtml(value)}</td>
        </tr>
      `
    )
    .join("");
}

function textSummary(payload: Required<ContactPayload>) {
  return [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || "Not provided"}`,
    `Inquiry Type: ${payload.inquiry_type}`,
    `Preferred Reply Method: ${payload.reply_method}`,
    `Subject: ${payload.subject}`,
    "Message:",
    `${payload.message}`,
  ].join("\n");
}

function emailShell(title: string, intro: string, rows: string) {
  return `
    <div style="margin:0;padding:24px;background:#eef1f6;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dde3ed;">
        <div style="padding:24px;background:#081022;color:#ffffff;">
          <p style="margin:0 0 8px;color:#61ddd9;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">M.H Detailz</p>
          <h1 style="margin:0;font-size:24px;line-height:1.25;">${title}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 18px;color:#35445d;line-height:1.6;">${intro}</p>
          <table style="width:100%;border-collapse:collapse;background:#f8fafd;border-radius:10px;overflow:hidden;">
            ${rows}
          </table>
        </div>
      </div>
    </div>
  `;
}

function resendErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    if (
      "error" in error &&
      typeof error.error === "object" &&
      error.error !== null &&
      "message" in error.error &&
      typeof error.error.message === "string"
    ) {
      return error.error.message;
    }

    if ("name" in error && "statusCode" in error && typeof error.name === "string") {
      const message = "message" in error && typeof error.message === "string" ? error.message : "Unknown error";
      return `${error.name}: ${message}`;
    }
  }

  return "Unknown Resend error";
}

export async function POST(request: Request) {
  console.log("[CONTACT] POST received");
  console.log("[CONTACT] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
  console.log("[CONTACT] BOOKING_ADMIN_EMAIL:", process.env.BOOKING_ADMIN_EMAIL);
  
  if (!process.env.RESEND_API_KEY) {
    console.error("[CONTACT] ERROR: RESEND_API_KEY not configured");
    return NextResponse.json(
      { error: "Email service is not configured. Add RESEND_API_KEY in Vercel environment variables." },
      { status: 500 }
    );
  }

  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Contact details were not submitted correctly." }, { status: 400 });
  }

  const payload: Required<ContactPayload> = {
    name: clean(body.name),
    email: clean(body.email),
    phone: clean(body.phone),
    subject: clean(body.subject),
    inquiry_type: clean(body.inquiry_type),
    reply_method: clean(body.reply_method),
    message: clean(body.message),
  };

  if (!payload.name || !payload.email || !payload.subject || !payload.message) {
    return NextResponse.json({ error: "Please complete all required contact fields." }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const rows = renderRows(payload);
  const summary = textSummary(payload);

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    replyTo: payload.email,
    subject: `New contact message: ${payload.subject}`,
    html: emailShell("New contact message", "A new contact message was submitted from the website.", rows),
    text: `A new contact message was submitted from the website.\n\n${summary}`,
  });

  if (result.error) {
    const message = resendErrorMessage(result.error);
    console.error("[CONTACT] Resend email failed", { error: message, result });
    return NextResponse.json(
      { error: "Contact message could not be sent.", details: message },
      { status: 502 }
    );
  }

  console.info("[CONTACT] Email sent successfully", result);
  return NextResponse.json({ ok: true });
}
