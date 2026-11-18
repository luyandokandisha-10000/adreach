import { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Lock, MessageSquareText, ShieldCheck } from 'lucide-react';

function LegalLayout({ title, subtitle, lastUpdated, children }: { title: string; subtitle: string; lastUpdated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#1d3934] font-sans">
      <header className="border-b border-[#e5e3d8] bg-[#fbfaf5]/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#236b58] hover:text-[#184d3f] transition-colors">
            <ArrowLeft size={16} /> Back to AdReach
          </Link>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#697d77]">
            AdReach Zambia Legal
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 pb-8 border-b border-[#e5e3d8]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#236b58]/10 text-[#236b58] mb-3">
            <ShieldCheck size={14} /> Official Policy
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#143b31] mb-2">{title}</h1>
          <p className="text-base text-[#566e66] leading-relaxed">{subtitle}</p>
          <div className="text-xs text-[#88988e] mt-3">Effective Date: {lastUpdated} · Republic of Zambia</div>
        </div>

        <div className="prose prose-emerald max-w-none space-y-8 text-[#2e4a42] leading-relaxed text-sm md:text-base">
          {children}
        </div>

        <div className="mt-16 pt-8 border-t border-[#e5e3d8] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#697d77]">
          <div>© {new Date().getFullYear()} AdReach Zambia. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/terms" className="underline hover:text-[#236b58]">Terms of Service</Link>
            <Link href="/privacy" className="underline hover:text-[#236b58]">Privacy Policy</Link>
            <a href="mailto:luyandokandisha@gmail.com" className="underline hover:text-[#236b58]">Support</a>
          </div>
        </div>
      </main>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The rules, rights, and responsibilities governing use of AdReach Zambia."
      lastUpdated="November 2026"
    >
      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">1. Overview of Services</h2>
        <p>
          AdReach Zambia operates a specialized multi-channel advertising and social distribution platform designed to help Zambian businesses, entrepreneurs, and sole traders broadcast advertisements across verified social media channels, targeted Facebook groups, WhatsApp communities, LinkedIn, Instagram, TikTok, and Telegram.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">2. Free Starter Tier &amp; Fair Usage</h2>
        <p>
          New registered businesses receive an initial allocation of <strong>ten (10) free ad submissions</strong> to experience the reach of the platform. Free submissions are subject to editorial review and must represent genuine products, services, job openings, or business offerings operating within Zambia. Automated scripting, multi-account spamming, or fraudulent duplicate submissions will result in immediate suspension.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">3. Prohibited Content &amp; Editorial Verification</h2>
        <p>To protect Zambian consumers and community partners, all advertisements must adhere to our safety standards. We strictly prohibit:</p>
        <ul className="list-disc pl-5 space-y-1 my-3">
          <li>Ponzi schemes, pyramid networks, and unverified high-yield investment programs.</li>
          <li>Illegal or prescription medications not approved by the Zambia Medicines Regulatory Authority (ZAMRA).</li>
          <li>Counterfeit luxury goods, stolen property, or unauthorized weapons.</li>
          <li>Hate speech, defamatory attacks, or sexually explicit material.</li>
          <li>Deceptive claims or impersonation of established Zambian companies or institutions.</li>
        </ul>
        <p>
          AdReach reserves the absolute right to reject, edit for clarity, or request revisions on any submission prior to broadcast.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">4. Subscriptions, Payments &amp; Refunds</h2>
        <p>
          Paid plans (Weekly Boost at K20/week, Monthly Pro at K100/month) provide expanded submission volume and priority distribution. Payments are processed securely via Zambian Mobile Money (MTN MoMo, Airtel Money, Zamtel) or direct bank transfer.
        </p>
        <p className="mt-2">
          <strong>Refund Guarantee:</strong> If a paid ad is rejected by our editorial review team and cannot be appropriately modified to comply with policy, the advertiser is entitled to a full credit or refund upon request to support.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">5. Distribution &amp; Commercial Results</h2>
        <p>
          AdReach delivers your advertising message directly to active, relevant Zambian community groups and social channels. While we maximize visibility and engagement, actual sales conversion depends on your product quality, pricing, and responsiveness to incoming customer inquiries.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">6. Contact &amp; Governance</h2>
        <p>
          These terms are governed by the laws of the Republic of Zambia. For any questions regarding your account or terms, contact us at <a href="mailto:luyandokandisha@gmail.com" className="text-[#236b58] font-semibold underline">luyandokandisha@gmail.com</a> or via WhatsApp/Call at <a href="https://wa.me/260760312951" className="text-[#236b58] font-semibold underline">+260 760 312 951</a> (MTN Zambia).
        </p>
      </section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How AdReach Zambia collects, protects, and respects your personal and business information."
      lastUpdated="November 2026"
    >
      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">1. Commitment to Data Protection</h2>
        <p>
          AdReach Zambia is committed to safeguarding the personal and business data of all our users in accordance with the <strong>Data Protection Act, No. 3 of 2021</strong> of the Republic of Zambia.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">2. Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1 my-3">
          <li><strong>Account Details:</strong> Email address, business name, and contact telephone number provided during sign-up.</li>
          <li><strong>Authentication Credentials:</strong> Managed securely via Google Firebase Authentication. We never store raw passwords on our servers.</li>
          <li><strong>Ad Submissions:</strong> Headlines, descriptions, destination links, images, and video media that you submit for public distribution.</li>
          <li><strong>Transaction Records:</strong> Mobile Money transaction reference codes and payment confirmation receipts submitted to verify paid plans.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">3. How Information is Used</h2>
        <p>Your information is used strictly to:</p>
        <ul className="list-disc pl-5 space-y-1 my-3">
          <li>Authenticate your access to your ad dashboard and submission workspace.</li>
          <li>Publish and broadcast your approved advertisements to selected social networks and target groups.</li>
          <li>Send operational notifications, receipt confirmations, and customer support responses via email or WhatsApp.</li>
        </ul>
        <p className="mt-2 font-medium text-[#143b31]">
          We never sell, rent, or trade your personal contact details or business customer lists to any third-party advertisers or brokers.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">4. Data Security &amp; Storage</h2>
        <p>
          AdReach utilizes Google Firebase infrastructure with role-based security rules, encrypted transport (HTTPS/TLS 1.3), and segmented access controls. Only authorized platform administrators can access payment verification data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#143b31] mb-2">5. Your Rights as a Data Subject</h2>
        <p>
          Under the Zambian Data Protection Act, you have the right to request access to your stored personal information, request corrections, or request complete account deletion. To exercise any of these rights, contact our Data Support officer at <a href="mailto:luyandokandisha@gmail.com" className="text-[#236b58] font-semibold underline">luyandokandisha@gmail.com</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
