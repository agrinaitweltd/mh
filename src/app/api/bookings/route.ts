import { NextResponse } from "next/server";
import { Resend } from "resend";

const FROM_EMAIL = "M.H Detailz <no-reply@mhdetailz.site>";
const ADMIN_EMAIL = process.env.BOOKING_ADMIN_EMAIL ?? "mhdetailz6@gmail.com";

type BookingPayload = {
  name?: string;
  email?: string;
  phone?: string;
  make?: string;
  model?: string;
  reg?: string;
  colour?: string;
  vehicle_type?: string;
  service?: string;
  condition?: string;
  town?: string;
  postcode?: string;
  preferred_date?: string;
  notes?: string;
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

function renderRows(payload: Required<BookingPayload>) {
  const rows = [
    ["Name", payload.name],
    ["Email", payload.email],
    ["Phone", payload.phone],
    ["Service", payload.service],
    ["Preferred Date", payload.preferred_date || "Not selected"],
    ["Vehicle", `${payload.make} ${payload.model}`.trim()],
    ["Registration", payload.reg || "Not provided"],
    ["Colour", payload.colour || "Not provided"],
    ["Vehicle Type", payload.vehicle_type || "Not provided"],
    ["Condition", payload.condition || "Not provided"],
    ["Location", [payload.town, payload.postcode].filter(Boolean).join(", ") || "Not provided"],
    ["Notes", payload.notes || "None"],
  ];

  return rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e6ebf2;color:#55657d;font-weight:700;">${label}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6ebf2;color:#132036;">${escapeHtml(value)}</td>
      </tr>
    `)
    .join("");
}

function textSummary(payload: Required<BookingPayload>) {
  return [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `Service: ${payload.service}`,
    `Preferred Date: ${payload.preferred_date || "Not selected"}`,
    `Vehicle: ${`${payload.make} ${payload.model}`.trim()}`,
    `Registration: ${payload.reg || "Not provided"}`,
    `Colour: ${payload.colour || "Not provided"}`,
    `Vehicle Type: ${payload.vehicle_type || "Not provided"}`,
    `Condition: ${payload.condition || "Not provided"}`,
    `Location: ${[payload.town, payload.postcode].filter(Boolean).join(", ") || "Not provided"}`,
    `Notes: ${payload.notes || "None"}`,
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
          <p style="margin:18px 0 0;color:#6b7890;font-size:13px;line-height:1.5;">
            Prices may vary depending on vehicle type and condition. Payment is made in person.
          </p>
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
  console.log("[BOOKING] POST received");
  console.log("[BOOKING] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
  console.log("[BOOKING] BOOKING_ADMIN_EMAIL:", process.env.BOOKING_ADMIN_EMAIL);
  
  if (!process.env.RESEND_API_KEY) {
    console.error("[BOOKING] ERROR: RESEND_API_KEY not configured");
    return NextResponse.json(
      { error: "Email service is not configured. Add RESEND_API_KEY in Vercel environment variables." },
      { status: 500 }
    );
  }

  let body: BookingPayload;
  try {
    body = (await request.json()) as BookingPayload;
  } catch {
    return NextResponse.json({ error: "Booking details were not submitted correctly." }, { status: 400 });
  }

  const payload: Required<BookingPayload> = {
    name: clean(body.name),
    email: clean(body.email),
    phone: clean(body.phone),
    make: clean(body.make),
    model: clean(body.model),
    reg: clean(body.reg).toUpperCase(),
    colour: clean(body.colour),
    vehicle_type: clean(body.vehicle_type),
    service: clean(body.service),
    condition: clean(body.condition),
    town: clean(body.town),
    postcode: clean(body.postcode).toUpperCase(),
    preferred_date: clean(body.preferred_date),
    notes: clean(body.notes),
  };

  if (!payload.name || !payload.email || !payload.phone || !payload.make || !payload.model || !payload.service) {
    return NextResponse.json({ error: "Please complete all required booking fields." }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const rows = renderRows(payload);
  const summary = textSummary(payload);

  console.log("[BOOKING] Sending emails to:", { customer: payload.email, admin: ADMIN_EMAIL });

  const [customerSend, adminSend] = await Promise.allSettled([
    resend.emails.send({
      from: FROM_EMAIL,
      to: payload.email,
      subject: "We received your M.H Detailz booking",
      html: emailShell(
        "Booking request received",
        "Thanks for booking with M.H Detailz. We have received your request and will confirm your slot directly.",
        rows
      ),
      text: `Thanks for booking with M.H Detailz. We have received your request and will confirm your slot directly.\n\n${summary}`,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: payload.email,
      subject: `New booking request: ${payload.service}`,
      html: emailShell("New booking request", "A new booking request has been submitted from the website.", rows),
      text: `A new booking request has been submitted from the website.\n\n${summary}`,
    }),
  ]);

  const customerResult = customerSend.status === "fulfilled" ? customerSend.value : null;
  const adminResult = adminSend.status === "fulfilled" ? adminSend.value : null;
  const customerError = customerSend.status === "rejected" ? customerSend.reason : customerResult?.error;
  const adminError = adminSend.status === "rejected" ? adminSend.reason : adminResult?.error;

  console.log("[BOOKING] Email send results:", {
    customerStatus: customerSend.status,
    adminStatus: adminSend.status,
    customerHasError: !!customerError,
    adminHasError: !!adminError,
  });

  if (customerError) {
    console.error("[BOOKING] CUSTOMER email failed:", resendErrorMessage(customerError), customerResult);
  } else {
    console.info("[BOOKING] CUSTOMER email sent:", customerResult?.data?.id);
  }

  if (adminError) {
    console.error("[BOOKING] ADMIN email failed:", resendErrorMessage(adminError), adminResult);
  } else {
    console.info("[BOOKING] ADMIN email sent:", adminResult?.data?.id);
  }

  if (customerError || adminError) {
    const customerMessage = resendErrorMessage(customerError);
    const adminMessage = resendErrorMessage(adminError);
    console.error("[BOOKING] Resend email failed", {
      customerError: customerMessage,
      adminError: adminMessage,
      customerResult,
      adminResult,
    });
    return NextResponse.json(
      {
        error: "Email could not be sent. Check the Resend API key and that mhdetailz.site is verified in Resend.",
        details: { customer: customerMessage, admin: adminMessage },
      },
      { status: 502 }
    );
  }

  const response = {
    ok: true,
    customerEmailId: customerResult?.data?.id,
    adminEmailId: adminResult?.data?.id,
  };

  console.info("[BOOKING] Emails sent successfully", response);

  return NextResponse.json(response);
}
