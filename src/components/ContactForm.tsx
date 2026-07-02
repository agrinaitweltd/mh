"use client";

import { FormEvent, useState } from "react";

const INQUIRY_TYPES = [
  "General Question",
  "Partnership",
  "Feedback",
  "Support",
  "Other",
];

const REPLY_METHODS = ["Email", "Phone", "Either"];

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage("");
    setSubmitError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    if (payload.attachment instanceof File) {
      delete payload.attachment;
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({ error: "Unable to parse response from server." }));

      if (!response.ok) {
        throw new Error(result.error || "Message could not be sent.");
      }

      setSubmitMessage("Your message was sent successfully. We'll reply as soon as possible.");
      event.currentTarget.reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label>
        Full Name
        <input type="text" name="name" required />
      </label>

      <div className="form-row">
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Phone
          <input type="tel" name="phone" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Subject
          <input type="text" name="subject" required />
        </label>
        <label>
          Inquiry Type
          <select name="inquiry_type" defaultValue="General Question">
            {INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Preferred Reply Method
        <select name="reply_method" defaultValue="Email">
          {REPLY_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </label>

      <label>
        Reference File (Optional)
        <input type="file" name="attachment" accept="image/*,.pdf,.doc,.docx" className="form-file" />
      </label>

      <label>
        Message
        <textarea name="message" rows={5} placeholder="Tell us how we can help..." required />
      </label>

      {(submitMessage || submitError) && (
        <p className={`booking-status ${submitError ? "error" : "success"}`} role="status">
          <span className="booking-status-copy">
            <span>{submitError || submitMessage}</span>
          </span>
        </p>
      )}

      <button type="submit" className="btn-send-rust form-submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "SEND →"}
      </button>
    </form>
  );
}
