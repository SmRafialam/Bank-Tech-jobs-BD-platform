import type { Metadata } from "next";
import { Prose } from "@/components/prose";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <Prose title="Privacy policy" updated="27 September 2026">
      <p>We collect the minimum personal data needed to match you with jobs and send the alerts you ask for.</p>
      <h2>What we store</h2>
      <ul>
        <li>Account: email address, name and a salted bcrypt hash of your password.</li>
        <li>Optional profile: degree, discipline, university, CGPA, SSC/HSC GPA, experience, skills, preferences, age, certifications and current employer.</li>
        <li>Activity: saved jobs, your application tracker entries, notification history and settings.</li>
        <li>Delivery data: Telegram chat ID and browser push endpoints if you enable those channels.</li>
        <li>Security logs: sign-in events and IP addresses in the audit log, kept for security investigations.</li>
      </ul>
      <p>We do not ask for phone numbers, national ID numbers, photos or CV files. The application tracker stores only the CV version label you type.</p>
      <h2>How it is used</h2>
      <ul>
        <li>To calculate eligibility and match scores and to send alerts, digests and deadline reminders you enable.</li>
        <li>We do not sell or share your data. Emails are delivered through Resend; Telegram messages through the Telegram Bot API; browser push through your browser vendor&apos;s push service.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>Every profile field is optional. Turn channels off at any time in notification settings.</li>
        <li>To delete your account and data, contact the site administrator from your registered email address.</li>
      </ul>
      <h2>Cookies</h2>
      <p>We use one essential, HttpOnly session cookie to keep you signed in, plus a CSRF cookie used during sign-in. No advertising or tracking cookies.</p>
    </Prose>
  );
}
