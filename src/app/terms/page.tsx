import type { Metadata } from "next";
import { Prose } from "@/components/prose";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <Prose title="Terms of use" updated="27 September 2026">
      <h2>The service</h2>
      <p>
        BankTech Jobs BD aggregates publicly available job information and links to official sources. Listings may be incomplete, delayed or
        contain extraction errors. Eligibility results are automated guidance, not a determination by any employer.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Verify every job on the official source and apply only through the official channel.</li>
        <li>Submit only genuine, publicly available job links with a summary in your own words. Do not submit copyrighted circulars in full.</li>
        <li>Do not attempt to scrape, overload or bypass the security of this site.</li>
      </ul>
      <h2>Content and trademarks</h2>
      <p>
        Organisation names belong to their owners and are used only to identify employers. If you represent a listed organisation and want a
        listing corrected or removed, or want your career page excluded from collection, contact the administrator — requests are honoured promptly,
        and any source can be disabled immediately.
      </p>
      <h2>Liability</h2>
      <p>The service is provided “as is” without warranties. We are not responsible for decisions made on the basis of listings or eligibility results.</p>
    </Prose>
  );
}
