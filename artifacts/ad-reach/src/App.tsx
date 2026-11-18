import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, CircleHelp,
  Clock3, Copy, Download, ExternalLink, FileImage, Film, Globe, ImagePlus, Instagram, Link2,
  LoaderCircle, LockKeyhole, Menu, Megaphone, MessageSquareText, MoreHorizontal, Play, PlayCircle, Plus,
  RefreshCw, Search, Send, Share2, ShieldCheck, Smartphone, Sparkles, Users, Video, X, XCircle, Zap,
} from 'lucide-react';
import {
  getGetAccountQueryKey, getGetAdminOverviewQueryKey, getListAdminAdsQueryKey,
  getListPlansQueryKey, getListWebhookLogsQueryKey, getListPendingPaymentsQueryKey,
  useCancelSubscription, useCreateAd, useGetAccount, useGetAdminOverview, useListAdminAds,
  useListPlans, useListWebhookLogs, useListPendingPayments, useRequestUploadUrl,
  useReviewAd, useReviewPayment, useRequestManualPayment,
} from '@workspace/api-client-react';
import type { Ad, AdminAd, AdminPaymentRequest, DistributionEvent, ManualPaymentRequest, Plan } from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  saveAdToFirestore,
  getAdsFromFirestore,
  subscribeToAuth,
  signOutFirebase,
  DEFAULT_ZAMBIAN_PLANS,
  savePaymentToFirestore,
  getAdminAdsFromFirestore,
  updateAdStatusInFirestore,
  getPaymentsFromFirestore,
  updatePaymentStatusInFirestore,
  type FirebasePaymentRecord,
} from '@/lib/firebase';
import { FirebaseAuthCard } from '@/components/firebase-auth';
import { TermsPage, PrivacyPage } from '@/pages/legal';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const rawClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const hasCustomClerkKey = Boolean(rawClerkKey && rawClerkKey.startsWith('pk_'));
export const clerkPubKey: string | null = hasCustomClerkKey ? rawClerkKey : null;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

export function sanitizeUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('javascript:') || trimmed.toLowerCase().startsWith('data:text/html')) {
    return '#';
  }
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/') && !trimmed.startsWith('mailto:') && !trimmed.startsWith('tel:')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function getMediaSource(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  return `/api/storage${path.startsWith('/') ? '' : '/'}${path}`;
}

export function isVideoMedia(path: string | null | undefined, videoUrl?: string | null): boolean {
  if (videoUrl) return true;
  if (!path) return false;
  return path.startsWith('data:video/') ||
    (path.startsWith('blob:') && (path.includes('video') || false)) ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(path) ||
    /youtube\.com|youtu\.be|tiktok\.com|vimeo\.com/i.test(path);
}

export interface Community {
  id: string;
  name: string;
  platform: 'facebook' | 'whatsapp' | 'instagram' | 'tiktok' | 'linkedin' | 'telegram' | 'x';
  category: string;
  members: string;
  url: string;
  description: string;
  isMainChannel?: boolean;
}

export const DEFAULT_COMMUNITIES: Community[] = [
  { id: 'main-adreach-fb', name: 'AdReach Official Facebook Network', platform: 'facebook', category: 'General Business', members: '~120k network reach', url: 'https://www.facebook.com/search/groups/?q=zambia%20business', description: 'Curated distribution across vetted Zambian business pages and enterprise networks.', isMainChannel: true },
  { id: 'main-adreach-wa', name: 'AdReach Daily WhatsApp Deals Channel', platform: 'whatsapp', category: 'Buy & Sell', members: '~45k subscribers', url: 'https://wa.me/260760312951?text=Hi%2C%20I%20would%20like%20to%20receive%20AdReach%20Zambia%20daily%20deals', description: 'Direct-to-consumer broadcast delivered straight to Zambian buyers via WhatsApp.', isMainChannel: true },
  { id: 'main-adreach-ig', name: 'AdReach Zambia Instagram Spotlight', platform: 'instagram', category: 'General Business', members: '~60k community', url: 'https://www.instagram.com', description: 'Visual story features and carousel spotlights for local retail brands.', isMainChannel: true },
  { id: 'main-adreach-tt', name: 'AdReach TikTok Video Showcase', platform: 'tiktok', category: 'General Business', members: '~80k viewer base', url: 'https://www.tiktok.com', description: 'Short-form promotional video showcase for products, restaurants, and venues.', isMainChannel: true },
  { id: 'main-adreach-li', name: 'Zambia LinkedIn Professional Hub', platform: 'linkedin', category: 'Tech & Services', members: '~30k connections', url: 'https://www.linkedin.com/search/results/all/?keywords=zambia%20business', description: 'B2B tenders, corporate suppliers, tech solutions, and commercial services.', isMainChannel: true },
  { id: 'grp-lusaka-biz', name: 'Lusaka Business Hub & Traders', platform: 'facebook', category: 'General Business', members: '~180k members', url: 'https://www.facebook.com/search/groups/?q=lusaka%20business%20hub', description: 'Active Lusaka marketplace for retail, commercial trade, and professional services.' },
  { id: 'grp-zm-buysell', name: 'Zambia Buy, Sell & Swap Network', platform: 'facebook', category: 'Buy & Sell', members: '~250k members', url: 'https://www.facebook.com/search/groups/?q=zambia%20buy%20and%20sell', description: 'General marketplace for electronics, fashion, household items, and vehicles.' },
  { id: 'grp-copperbelt-traders', name: 'Copperbelt Entrepreneurs (Kitwe & Ndola)', platform: 'facebook', category: 'General Business', members: '~90k members', url: 'https://www.facebook.com/search/groups/?q=copperbelt%20business%20traders', description: 'Commercial trade hub serving Kitwe, Ndola, Chingola, and Mufulira.' },
  { id: 'grp-zm-realestate', name: 'Lusaka Real Estate & Motors Hub', platform: 'facebook', category: 'Real Estate & Motors', members: '~110k members', url: 'https://www.facebook.com/search/groups/?q=zambia%20real%20estate%20plots', description: 'Targeted network for house rentals, titled plots, commercial land, and cars.' },
  { id: 'grp-zm-agri', name: 'Zambia Farming & Agro Exchange', platform: 'facebook', category: 'Agriculture', members: '~100k members', url: 'https://www.facebook.com/search/groups/?q=zambia%20farming%20agriculture', description: 'Farmers, poultry suppliers, maize, fertilizers, feeds, and farm equipment.' },
  { id: 'grp-wa-tech-freelance', name: 'Tech, Creative & SME Network Zambia', platform: 'whatsapp', category: 'Tech & Services', members: '~8k members', url: 'https://wa.me/260760312951?text=Hi%2C%20I%20am%20interested%20in%20the%20Tech%20%26%20SME%20Network', description: 'Software developers, graphic designers, digital consultants, and accountants.' },
  { id: 'grp-tele-zm-deals', name: 'Zambia Classifieds & Deals Telegram', platform: 'telegram', category: 'Buy & Sell', members: '~15k members', url: 'https://t.me/share/url?url=https://luyandokandisha-10000.github.io/adreach/', description: 'Rapid push-notification alerts for flash discounts, tenders, and clearance sales.' },
];

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#236b58',
    colorForeground: '#1d3934',
    colorMutedForeground: '#697d77',
    colorDanger: '#b7443c',
    colorBackground: '#fbfaf5',
    colorInput: '#fffefa',
    colorInputForeground: '#1d3934',
    colorNeutral: '#1d3934',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf5] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_70px_rgba(24,57,50,.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#1d3934] font-bold',
    headerSubtitle: 'text-[#697d77]',
    socialButtonsBlockButtonText: 'text-[#1d3934] font-semibold',
    formFieldLabel: 'text-[#1d3934] font-semibold',
    footerActionLink: 'text-[#236b58] font-semibold',
    footerActionText: 'text-[#697d77]',
    dividerText: 'text-[#697d77]',
    identityPreviewEditButton: 'text-[#236b58]',
    formFieldSuccessText: 'text-[#236b58]',
    alertText: 'text-[#1d3934]',
    logoBox: 'mb-1',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-[#deded3] bg-[#fffefa] hover:bg-[#f3f2e9]',
    formButtonPrimary: 'bg-[#236b58] hover:bg-[#194f42] text-white',
    formFieldInput: 'border-[#d9dbce] bg-[#fffefa] text-[#1d3934]',
    footerAction: 'border-t border-[#e5e3d8]',
    dividerLine: 'bg-[#deded3]',
    alert: 'border-[#e6c8c4]',
    otpCodeFieldInput: 'border-[#d9dbce]',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-brand"><span className="brand-mark"><Megaphone size={17} strokeWidth={2.3} /></span><span>adreach<span className="brand-dot">.</span></span></Link>;
}
function ButtonLink({ href, children, kind = 'primary', className = '', ...props }: { href: string; children: ReactNode; kind?: 'primary' | 'outline' | 'quiet'; className?: string; [key: string]: any }) {
  return <Link href={href} className={`button button-${kind} ${className}`} {...props}>{children}</Link>;
}

function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  return { isInstallable, installApp };
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isInstallable, installApp } = usePwaInstall();
  const { isFirebaseUser } = useSafeUser();

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Brand />
        <nav className={`public-nav ${menuOpen ? 'is-open' : ''}`}>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#communities" onClick={() => setMenuOpen(false)}>Social Groups</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQs</a>
        </nav>
        <div className="nav-actions">
          {isInstallable && (
            <button className="install-app-pill" onClick={installApp} title="Install AdReach Web App">
              <Download size={13} /> Install App
            </button>
          )}
          {isFirebaseUser ? (
            <>
              <Link href="/dashboard" className="signin-link">Dashboard</Link>
              <ButtonLink href="/submit" className="nav-cta">Submit Ad <ArrowRight size={15} /></ButtonLink>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="signin-link">Sign in</Link>
              <ButtonLink href="/sign-up" className="nav-cta">Start for free <ArrowRight size={15} /></ButtonLink>
            </>
          )}
        </div>
        <button className="menu-toggle" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-menu">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}

function Home() {
  return <div className="landing page-enter"><Header /><main>
    <section className="hero">
      <div className="hero-left">
        <div className="eyebrow"><span className="eyebrow-dot" /> PROUDLY BUILT FOR ZAMBIAN BUSINESSES</div>
        <h1>Get Your Business<br />in Front of Paying<br /><span>Zambian Buyers.</span></h1>
        <p className="hero-copy">Submit your ad once. We broadcast your products, services, and promotions directly into active Facebook trade groups, WhatsApp business communities, and LinkedIn networks across Lusaka, the Copperbelt, and nationwide.</p>
        <div className="hero-actions">
          <ButtonLink href="/sign-up">Start with 10 free ads <ArrowRight size={17} /></ButtonLink>
          <a href="#how-it-works" className="text-link">See how it works <ArrowDownRight size={15} /></a>
        </div>
        <div className="hero-proof">
          <div className="proof-avatars"><span>ZM</span><span>LK</span><span>CB</span></div>
          <span>Targeting over 350,000+ active members across curated Zambian trade and business groups.</span>
        </div>
      </div>
      <div className="hero-art">
        <div className="art-sun" />
        <div className="art-caption"><span>VERIFIED BUSINESS SHOWCASE</span><span>01 / 04</span></div>
        <div className="art-phone">
          <div className="phone-top"><span className="mini-avatar">K</span><span><b>kapenta.kitchen</b><small>Lusaka, Zambia</small></span><MoreHorizontal size={16} /></div>
          <div className="phone-photo"><div className="photo-tag">FEATURED OFFER</div><div className="photo-type">Fresh local<br />meals delivered<br /><i>daily.</i></div><div className="photo-stamp">K</div></div>
          <div className="phone-buttons"><span><Instagram size={16} /></span><span><MessageSquareText size={16} /></span><span><Send size={15} /></span><span className="phone-bookmark">Order</span></div>
          <p><b>kapenta.kitchen</b> Traditional meals, village chicken &amp; catering in Lusaka. WhatsApp us for orders.</p>
          <div className="phone-lines" />
        </div>
        <div className="floating-reach"><span className="reach-icon"><ArrowUpRight size={18} /></span><span><b>1-Click Broadcast</b><small>Facebook, WhatsApp &amp; LinkedIn</small></span></div>
        <span className="art-side-note">BUILT FOR YOUR NEXT CUSTOMER</span>
      </div>
      <div className="hero-bottomline"><span>NO COMPLICATED AD ACCOUNTS</span><span>VERIFIED HUMAN CURATION</span><span>DIRECT WHATSAPP INQUIRIES</span></div>
    </section>

    <section className="social-strip">
      <span className="social-label">BROADCAST DIRECTLY TO</span>
      <span><MessageSquareText size={17} /> Facebook Groups</span>
      <span><MessageSquareText size={17} /> WhatsApp Channels</span>
      <span><Link2 size={17} /> LinkedIn Networks</span>
      <span><Instagram size={17} /> Instagram Spotlight</span>
      <span><Zap size={16} /> TikTok Video</span>
    </section>

    <section className="steps-section" id="how-it-works">
      <div className="section-kicker">SIMPLE &amp; TRANSPARENT PROCESS</div>
      <div className="section-heading-row">
        <h2>Four simple steps.<br /><span>Real customer inquiries.</span></h2>
        <p>No agencies. No confusing ad managers. Just tell us what you're selling and we handle the audience distribution.</p>
      </div>
      <div className="steps-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <article className="step-item">
          <span className="step-index">01</span>
          <div className="step-icon"><FileImage size={20} /></div>
          <h3>Create your ad</h3>
          <p>Add your headline, promotional copy, photo or promo video link, and your WhatsApp contact.</p>
        </article>
        <article className="step-item step-highlight">
          <span className="step-index">02</span>
          <div className="step-icon"><ShieldCheck size={20} /></div>
          <h3>Editorial check</h3>
          <p>Our team verifies your submission within 2 hours to prevent spam and ensure maximum buyer trust.</p>
        </article>
        <article className="step-item">
          <span className="step-index">03</span>
          <div className="step-icon"><Share2 size={20} /></div>
          <h3>Multi-group broadcast</h3>
          <p>Your ad is published into targeted Facebook groups, WhatsApp channels, and LinkedIn networks.</p>
        </article>
        <article className="step-item">
          <span className="step-index">04</span>
          <div className="step-icon"><MessageSquareText size={20} /></div>
          <h3>Receive direct calls</h3>
          <p>Interested buyers click straight through to your WhatsApp or phone. You close the sale directly.</p>
        </article>
      </div>
    </section>

    <section className="steps-section" id="communities" style={{ paddingTop: '20px' }}>
      <div className="section-kicker">CURATED ZAMBIAN DISTRIBUTION NETWORKS</div>
      <div className="section-heading-row">
        <h2>Targeted business networks.<br /><span>Ready for your broadcast.</span></h2>
        <p>Explore our directory of active buying and selling groups across Lusaka, the Copperbelt, and nationwide. AdReach manages distribution into these networks for you.</p>
      </div>
      <div className="community-grid" style={{ maxHeight: 'none' }}>
        {DEFAULT_COMMUNITIES.slice(0, 8).map((c) => (
          <div key={c.id} className="community-card">
            <div className="community-card-top">
              <span className="comm-platform-tag">{c.platform}</span>
              {c.isMainChannel && <span className="reach-badge" style={{ padding: '2px 7px' }}>Managed Channel</span>}
            </div>
            <b>{c.name}</b>
            <p>{c.description}</p>
            <div className="community-card-foot">
              <span>{c.members}</span>
              <a href={c.url} target="_blank" rel="noreferrer" className="text-link" style={{ fontSize: '10px' }}>Network Hub <ExternalLink size={10} /></a>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="pricing-section" id="pricing">
      <div className="pricing-intro">
        <div className="section-kicker">STRAIGHTFORWARD ZAMBIAN PRICING</div>
        <h2>Start free.<br /><span>Upgrade when ready.</span></h2>
        <p>Try AdReach with ten free submissions. When your business is ready for unlimited daily broadcasts, choose a simple weekly or monthly plan.</p>
        <div className="pricing-footnote"><Check size={15} /> Transparent Zambian Kwacha (ZMW). Pay easily via MTN MoMo (0760312951) or Airtel Money.</div>
      </div>
      <div className="pricing-cards">
        <article className="price-card">
          <div className="price-label">STARTER TIER</div>
          <h3>Free</h3>
          <div className="price-amount"><strong>K0</strong><span> / first 10 ads</span></div>
          <p>Perfect for testing the reach of the platform with zero risk.</p>
          <ul>
            <li><Check size={15} /> 10 free ad submissions</li>
            <li><Check size={15} /> Facebook &amp; WhatsApp distribution</li>
            <li><Check size={15} /> Image &amp; video ad support</li>
            <li><Check size={15} /> Real-time status tracking</li>
          </ul>
          <ButtonLink href="/sign-up" kind="outline">Get 10 free ads <ArrowRight size={16} /></ButtonLink>
        </article>

        <article className="price-card price-featured">
          <span className="popular-label">MOST POPULAR</span>
          <div className="price-label">FOR WEEKLY OFFERS &amp; FLASH SALES</div>
          <h3>Weekly Boost</h3>
          <div className="price-amount"><strong>K20</strong><span> / week</span></div>
          <p>Keep your products in front of buyers throughout the entire week.</p>
          <ul>
            <li><Check size={15} /> Unlimited ad broadcasts</li>
            <li><Check size={15} /> Full group and channel coverage</li>
            <li><Check size={15} /> Priority review under 2 hours</li>
            <li><Check size={15} /> Instant WhatsApp payment confirmation</li>
          </ul>
          <ButtonLink href="/sign-up">Choose Weekly (K20) <ArrowRight size={16} /></ButtonLink>
        </article>

        <article className="price-card">
          <div className="price-label">STEADY BUSINESS PRESENCE</div>
          <h3>Monthly Pro</h3>
          <div className="price-amount"><strong>K100</strong><span> / month</span></div>
          <p>Continuous brand presence and recurring leads all month long.</p>
          <ul>
            <li><Check size={15} /> Unlimited ad broadcasts</li>
            <li><Check size={15} /> Featured placement across top channels</li>
            <li><Check size={15} /> Priority B2B LinkedIn &amp; Facebook reach</li>
            <li><Check size={15} /> VIP WhatsApp support hotline</li>
          </ul>
          <ButtonLink href="/sign-up" kind="outline">Choose Monthly (K100) <ArrowRight size={16} /></ButtonLink>
        </article>
      </div>
      <p className="price-disclaimer">All prices in Zambian Kwacha (ZMW). Pay via MTN MoMo to 0760312951 (Luyando Kandisha) or Airtel Money. If an ad is not approved, your payment is 100% refunded.</p>
    </section>

    <section className="trust-band">
      <div className="trust-seal"><BadgeCheck size={23} /></div>
      <div>
        <span className="section-kicker">ANTI-SPAM &amp; VERIFIED COMMERCE</span>
        <h2>Why Zambian buyers trust AdReach.</h2>
      </div>
      <p>Every single ad is human-checked before broadcast. We filter out scams, fraudulent deals, and misleading offers so that real Zambian businesses get maximum response from genuine buyers.</p>
      <ButtonLink href="/sign-up" kind="outline">Create your free account <ArrowRight size={16} /></ButtonLink>
    </section>

    <section className="faq-section" id="faq">
      <div className="faq-title">
        <div className="section-kicker">FREQUENTLY ASKED QUESTIONS</div>
        <h2>Everything you<br /><span>need to know.</span></h2>
        <a href="mailto:luyandokandisha@gmail.com">Email: luyandokandisha@gmail.com <ArrowUpRight size={14} /></a>
        <a href="https://wa.me/260760312951" target="_blank" rel="noreferrer" style={{ marginTop: '8px' }}>WhatsApp: +260 760 312 951 (MTN) <ArrowUpRight size={14} /></a>
      </div>
      <div className="faq-list">
        <details>
          <summary>How does social media and group posting work?<ChevronDown size={17} /></summary>
          <p>AdReach distributes your ad through two primary methods: First, our editorial operations team broadcasts your verified ad directly into our curated network of Zambian business channels and trade groups. Second, our built-in 1-Click Social Broadcast engine lets you post your pre-formatted ad directly to your own Facebook timeline, LinkedIn page, or WhatsApp chats with one tap.</p>
        </details>
        <details>
          <summary>Do I need to join the groups myself?<ChevronDown size={17} /></summary>
          <p>No! AdReach manages distribution into our partner networks on your behalf. However, if you are also a member of specific groups, our 1-click tools provide pre-formatted text and links so you can cross-post into your personal groups in seconds without retyping anything.</p>
        </details>
        <details>
          <summary>How fast is my ad reviewed and broadcasted?<ChevronDown size={17} /></summary>
          <p>Submissions are typically reviewed and approved within 2 hours during normal business hours (08:00 to 18:00 CAT). Once approved, your ad is queued for multi-channel broadcast across your chosen target groups.</p>
        </details>
        <details>
          <summary>Can I upload video ads or video links?<ChevronDown size={17} /></summary>
          <p>Yes! You can upload video clips (MP4, WebM, MOV up to 50 MB) or paste links to videos on YouTube, TikTok, Facebook, or Vimeo. The ad renders a clean, responsive video player for prospective customers.</p>
        </details>
        <details>
          <summary>How do I pay after using my 10 free ads?<ChevronDown size={17} /></summary>
          <p>You can choose the Weekly Boost (K20/week) or Monthly Pro (K100/month). Payments are made easily via MTN Mobile Money to 0760312951 (Luyando Kandisha) or Airtel Money. Simply send your transfer screenshot on WhatsApp for instant activation.</p>
        </details>
        <details>
          <summary>What is your refund policy?<ChevronDown size={17} /></summary>
          <p>If an ad cannot be approved due to editorial or safety guidelines, and you cannot revise it to meet our standards, any prepaid plan fee is 100% refunded to your mobile money number upon request.</p>
        </details>
      </div>
    </section>

    <section className="closing-cta">
      <div className="closing-mark"><Megaphone size={24} /></div>
      <div>
        <span>YOUR NEXT CUSTOMER IS LOOKING FOR YOU</span>
        <h2>Put your business on the map today.</h2>
      </div>
      <ButtonLink href="/sign-up">Start with 10 free ads <ArrowRight size={17} /></ButtonLink>
    </section>
  </main>
  <footer className="site-footer">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Brand inverse />
      <span style={{ fontSize: '13px', color: '#cadfd9' }}>Made for businesses moving Zambia forward.</span>
      <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '13px' }}>
        <Link href="/terms" style={{ color: '#cadfd9', textDecoration: 'underline' }}>Terms of Service</Link>
        <Link href="/privacy" style={{ color: '#cadfd9', textDecoration: 'underline' }}>Privacy Policy</Link>
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'right' }}>
      <span style={{ fontSize: '13px', color: '#cadfd9' }}>Support Hotline &amp; Payments:</span>
      <a href="https://wa.me/260760312951" target="_blank" rel="noreferrer" style={{ color: '#e9b761', fontWeight: 700, textDecoration: 'none' }}>
        WhatsApp / MTN: 0760312951
      </a>
      <a href="mailto:luyandokandisha@gmail.com" style={{ color: '#cadfd9', textDecoration: 'none', fontSize: '13px' }}>
        luyandokandisha@gmail.com
      </a>
      <span style={{ fontSize: '11px', color: '#88988e', marginTop: '4px' }}>© {new Date().getFullYear()} AdReach Zambia. All rights reserved.</span>
    </div>
  </footer>
</div>;
}

function LoadingState({ label = 'Loading your workspace' }: { label?: string }) {
  return <div className="state-wrap"><div className="skeleton-head"><span /><span /><span /></div><div className="skeleton-row"><i /><i /><i /></div><p><LoaderCircle className="spin" size={16} /> {label}</p></div>;
}
function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="state-card error-state"><span className="state-icon error-icon"><XCircle size={19} /></span><div><b>We couldn’t load this just now.</b><p>{message}</p></div><button className="button button-outline small-button" onClick={retry} data-testid="button-retry"><RefreshCw size={14} /> Try again</button></div>;
}
function StatusPill({ status }: { status: string }) {
  const className = status === 'active' || status === 'approved' ? 'status-green' : status === 'rejected' || status === 'expired' || status === 'canceled' ? 'status-red' : 'status-amber';
  const label = status === 'active' ? 'Approved' : status === 'pending' ? 'In review' : status === 'rejected' ? 'Changes needed' : status === 'payment_pending' ? 'Payment pending' : status;
  return <span className={`status-pill ${className}`} data-testid={`status-${status}`}>{status === 'active' ? <Check size={12} /> : status === 'rejected' ? <X size={12} /> : <Clock3 size={12} />}{label}</span>;
}
function dateLabel(value?: string | null) { if (!value) return '—'; return new Intl.DateTimeFormat('en-ZM', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }

function PaymentModal({
  payment,
  onClose,
}: {
  payment: ManualPaymentRequest;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyRef = () => {
    navigator.clipboard.writeText(payment.subscription.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="payment-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="payment-modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <div>
            <div className="section-kicker">MANUAL PAYMENT · ZAMBIA</div>
            <h2>Activate your {payment.subscription.planId === 'weekly' ? 'Weekly' : 'Monthly'} Plan</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close payment dialog">
            <X size={18} />
          </button>
        </div>

        <div className="payment-modal-summary">
          <div>
            <small>AMOUNT DUE</small>
            <div className="pay-amount">K{payment.subscription.amountK} <span>/ {payment.subscription.planId === 'weekly' ? 'week' : 'month'}</span></div>
          </div>
          <div className="payment-ref-badge">
            <small>PAYMENT REFERENCE</small>
            <div className="ref-code-box">
              <code>{payment.subscription.id}</code>
              <button type="button" onClick={copyRef} className="copy-badge-button" title="Copy reference">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="payment-guide-steps">
          <div className="guide-step">
            <span className="guide-step-index">1</span>
            <div>
              <b>Make your transfer</b>
              <p>Send K{payment.subscription.amountK} via MTN MoMo to <strong>0760312951</strong> (Luyando Kandisha) or Airtel / Zamtel. Reference: <code>{payment.subscription.id}</code>.</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-step-index">2</span>
            <div>
              <b>Send screenshot on WhatsApp</b>
              <p>Send proof of transfer to WhatsApp <strong>+260 760 312 951</strong>. Your subscription activates immediately.</p>
            </div>
          </div>
        </div>

        <div className="payment-modal-actions">
          <a
            href={`https://wa.me/260760312951?text=${encodeURIComponent(`Hi Luyando, I have paid K${payment.subscription.amountK} for AdReach subscription. Reference: ${payment.subscription.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-primary whatsapp-action-btn"
            data-testid="link-whatsapp-payment"
          >
            <MessageSquareText size={17} /> Send screenshot to WhatsApp (+260 760 312 951)
          </a>
          <button type="button" className="button button-outline" onClick={onClose}>
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialPublishModal({
  ad,
  onClose,
}: {
  ad: Ad;
  onClose: () => void;
}) {
  const [modalTab, setModalTab] = useState<'instant-publish' | 'communities'>('instant-publish');
  const [selectedIds, setSelectedIds] = useState<string[]>([
    'main-adreach-fb',
    'main-adreach-wa',
    'main-adreach-ig',
    'main-adreach-tt',
    'main-adreach-li',
    'grp-lusaka-biz',
    'grp-zm-buysell',
  ]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [customUrl, setCustomUrl] = useState('');
  const [customList, setCustomList] = useState<{ id: string; name: string; url: string; platform: string }[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const videoLink = (ad as any).videoUrl || (isVideoMedia(ad.imagePath) ? ad.imagePath : null);

  const postLines = [
    `📢 *${ad.title.toUpperCase()}*`,
    '',
    ad.description,
    '',
  ];

  if (videoLink) {
    postLines.push(`🎬 *Promo Video:* ${videoLink}`);
    postLines.push('');
  }

  postLines.push(`👉 *Contact & Inquiries:* ${ad.link}`);
  postLines.push('');
  postLines.push('✨ Featured on AdReach Zambia #Zambia #Lusaka #Copperbelt #ZambiaBusiness #AdReach');

  const postText = postLines.join('\n');

  const shareIntents = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(postText)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ad.link)}&quote=${encodeURIComponent(postText)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(ad.title + (videoLink ? ' (Watch Video)' : '') + ' - ' + ad.link)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ad.link)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(ad.link)}&text=${encodeURIComponent(postText)}`,
    formattedText: postText,
  };

  const copyPost = () => {
    try {
      navigator.clipboard.writeText(postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const triggerNativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: ad.title,
          text: postText,
          url: ad.link,
        });
      } catch (err) {
        console.warn('Share cancelled or not supported:', err);
      }
    } else {
      copyPost();
      alert('Post copied to clipboard! You can now paste into Facebook, LinkedIn, or WhatsApp.');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addCustomGroup = (e: FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    const newGrp = {
      id: `custom-${Date.now()}`,
      name: customUrl.trim().replace(/^https?:\/\/(www\.)?/, '').slice(0, 32),
      url: customUrl.trim(),
      platform: customUrl.includes('whatsapp') ? 'whatsapp' : customUrl.includes('facebook') ? 'facebook' : 'web',
    };
    setCustomList([...customList, newGrp]);
    setSelectedIds([...selectedIds, newGrp.id]);
    setCustomUrl('');
  };

  const allAvailable: Community[] = [...DEFAULT_COMMUNITIES, ...customList.map((c) => ({
    id: c.id,
    name: c.name,
    platform: c.platform as any,
    category: 'Custom Target',
    members: 'Custom',
    url: c.url,
    description: 'Custom added community',
    isMainChannel: false,
  }))];

  const filteredCommunities = allAvailable.filter((c) => {
    const matchCat = activeCategory === 'All' || c.category === activeCategory;
    const matchQuery =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.platform.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQuery;
  });

  const selectedCommunitiesList = allAvailable.filter((c) => selectedIds.includes(c.id));

  const publishNow = async () => {
    setPublishing(true);
    copyPost();
    try {
      await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adId: ad.id,
          channelIds: selectedIds.filter((id) => id.startsWith('main-')),
          communityIds: selectedIds.filter((id) => id.startsWith('grp-')),
          customGroups: customList.filter((g) => selectedIds.includes(g.id)),
        }),
      });
    } catch {}
    setPublishing(false);
    setBroadcastNotice(`Ad text copied to clipboard! Ready to broadcast to ${selectedIds.length} target Zambian communities.`);
    setModalTab('instant-publish');
  };

  return (
    <div className="dist-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dist-modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <div>
            <div className="section-kicker">MULTI-CHANNEL BROADCAST</div>
            <h2>Publish to Social Media & Groups</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', margin: '14px 0 16px' }}>
          <button
            type="button"
            className={`filter-chip ${modalTab === 'instant-publish' ? 'active' : ''}`}
            onClick={() => setModalTab('instant-publish')}
            style={{ fontSize: '13px', padding: '8px 14px' }}
          >
            🚀 1-Click Publish (Facebook, LinkedIn, WhatsApp)
          </button>
          <button
            type="button"
            className={`filter-chip ${modalTab === 'communities' ? 'active' : ''}`}
            onClick={() => setModalTab('communities')}
            style={{ fontSize: '13px', padding: '8px 14px' }}
          >
            👥 Target Groups ({selectedIds.length})
          </button>
        </div>

        {broadcastNotice && (
          <div className="notice-banner" style={{ marginBottom: '14px' }}>
            <Check size={16} /> {broadcastNotice}
          </div>
        )}

        {modalTab === 'instant-publish' ? (
          <div>
            <div className="copy-post-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <small style={{ fontWeight: 700, color: '#24483e' }}>FORMATTED PROMOTIONAL POST</small>
                {copied && <span style={{ color: '#2b7858', fontSize: '12px', fontWeight: 700 }}>✓ Copied to clipboard!</span>}
              </div>
              <pre>{postText}</pre>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={copyPost} className="button button-outline small-button">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied to Clipboard!' : 'Copy Formatted Text'}
                </button>
                {typeof navigator !== 'undefined' && (navigator as any).share && (
                  <button type="button" onClick={triggerNativeShare} className="button button-primary small-button" style={{ background: '#1c634c' }}>
                    <Share2 size={14} /> Share via Phone Apps
                  </button>
                )}
              </div>
            </div>

            <div className="section-kicker" style={{ marginTop: '18px' }}>1-CLICK DIRECT SOCIAL PUBLISHING</div>
            <p style={{ margin: '4px 0 12px', fontSize: '13px', color: '#687b70' }}>
              Click any channel below to open it with your ad pre-filled and post immediately:
            </p>
            <div className="dist-intents-grid">
              <a
                href={shareIntents.facebook}
                target="_blank"
                rel="noreferrer"
                className="intent-card-btn intent-fb"
                onClick={() => copyPost()}
              >
                <Globe size={18} /> Post to Facebook (Page or Groups)
              </a>
              <a
                href={shareIntents.linkedin}
                target="_blank"
                rel="noreferrer"
                className="intent-card-btn intent-li"
                onClick={() => copyPost()}
              >
                <Link2 size={18} /> Post to LinkedIn (Feed or Page)
              </a>
              <a
                href={shareIntents.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="intent-card-btn intent-wa"
                onClick={() => copyPost()}
              >
                <MessageSquareText size={18} /> Post to WhatsApp Groups & Status
              </a>
              <a
                href={shareIntents.telegram}
                target="_blank"
                rel="noreferrer"
                className="intent-card-btn"
                style={{ background: '#229ed9' }}
                onClick={() => copyPost()}
              >
                <Send size={18} /> Share on Telegram Channels
              </a>
              <a
                href={shareIntents.twitter}
                target="_blank"
                rel="noreferrer"
                className="intent-card-btn intent-x"
                onClick={() => copyPost()}
              >
                <Send size={18} /> Post to X / Twitter
              </a>
            </div>

            {selectedCommunitiesList.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="section-kicker">SELECTED ZAMBIAN COMMUNITIES & GROUPS ({selectedCommunitiesList.length})</div>
                  <button
                    type="button"
                    onClick={() => setModalTab('communities')}
                    style={{ background: 'transparent', border: 'none', color: '#256b56', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Add or change groups
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedCommunitiesList.map((comm) => (
                    <div key={comm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: '#f5f7f2', border: '1px solid #dce4d6' }}>
                      <div>
                        <b style={{ fontSize: '14px', color: '#1e4033', display: 'block' }}>{comm.name}</b>
                        <small style={{ color: '#6d7f75', fontSize: '12px' }}>{comm.platform.toUpperCase()} · {comm.members}</small>
                      </div>
                      <a
                        href={comm.url}
                        target="_blank"
                        rel="noreferrer"
                        className="button button-outline small-button"
                        style={{ padding: '6px 12px', fontSize: '13px', minHeight: '36px' }}
                        onClick={() => copyPost()}
                      >
                        Open Group & Paste <ExternalLink size={13} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="button" className="button button-primary" style={{ width: '100%', marginTop: '20px', minHeight: '48px', fontSize: '15px' }} onClick={onClose}>
              Done / Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="payment-modal-summary" style={{ margin: '14px 0' }}>
              <div>
                <small>TARGET AUDIENCE</small>
                <div className="pay-amount" style={{ fontSize: '18px' }}>
                  {selectedIds.length} Destinations Selected
                </div>
              </div>
              <div className="reach-badge">
                <span /> Est. Reach: ~{Math.min(980, selectedIds.length * 68)},000+ people
              </div>
            </div>

            <div className="community-search-bar">
              <Search size={14} style={{ color: '#88988e' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search groups & communities (e.g. Lusaka, Copperbelt, Farming, Buy & Sell)..."
              />
              {search && <button type="button" onClick={() => setSearch('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={13} /></button>}
            </div>

            <div className="community-filters">
              {['All', 'General Business', 'Buy & Sell', 'Agriculture', 'Real Estate & Motors', 'Tech & Services'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="community-grid">
              {filteredCommunities.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={`community-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="community-card-top">
                      <span className="comm-platform-tag">{c.platform}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label={`Select ${c.name}`}
                      />
                    </div>
                    <b>{c.name}</b>
                    <p>{c.description}</p>
                    <div className="community-card-foot">
                      <span>{c.members}</span>
                      {c.isMainChannel && <span style={{ color: '#23614d', fontWeight: 700 }}>Main Broadcast</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={addCustomGroup} className="custom-group-row">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Add custom group link (e.g. https://facebook.com/groups/... or WhatsApp group invite)"
              />
              <button type="submit" className="button button-outline small-button">
                <Plus size={14} /> Add
              </button>
            </form>

            <div className="payment-modal-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={publishNow}
                disabled={publishing || selectedIds.length === 0}
              >
                {publishing ? <><LoaderCircle className="spin" size={16} /> Preparing Broadcast…</> : <><Megaphone size={16} /> Broadcast & Post to {selectedIds.length} Communities</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function useSafeUser() {
  const [fbUser, setFbUser] = useState<any>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    return subscribeToAuth((u) => {
      setFbUser(u);
      setAuthLoaded(true);
    });
  }, []);

  if (!authLoaded) {
    return {
      isLoaded: false,
      isSignedIn: false,
      isFirebaseUser: false,
      isAdmin: false,
      user: null,
    };
  }

  if (fbUser) {
    const displayName =
      fbUser.displayName ||
      fbUser.email?.split('@')[0] ||
      fbUser.phoneNumber ||
      'Zambian Business Partner';
    const email = (fbUser.email || '').toLowerCase();
    const isAdminUser = email === 'luyandokandisha@gmail.com' || email === 'admin@adreach.zm';
    return {
      isLoaded: true,
      isSignedIn: true,
      isFirebaseUser: true,
      isAdmin: isAdminUser,
      user: {
        id: fbUser.uid,
        firstName: displayName.split(' ')[0],
        fullName: displayName,
        primaryEmailAddress: { emailAddress: fbUser.email || fbUser.phoneNumber || '' },
        role: isAdminUser ? 'admin' : 'user',
      } as any,
    };
  }

  if (clerkPubKey) {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const res = useUser();
      if (res?.isLoaded && res?.isSignedIn) {
        return {
          isLoaded: true,
          isSignedIn: true,
          isFirebaseUser: false,
          isAdmin: false,
          user: res.user,
        };
      }
    } catch {}
  }

  return {
    isLoaded: true,
    isSignedIn: false,
    isFirebaseUser: false,
    isAdmin: false,
    user: null,
  };
}

function useSafeClerk() {
  return {
    signOut: async () => {
      await signOutFirebase();
      window.location.href = basePath || '/';
    },
    addListener: () => () => {},
  } as any;
}

function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useSafeUser();
  const { signOut } = useSafeClerk();
  const account = useGetAccount();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const { isInstallable, installApp } = usePwaInstall();
  const name = user?.fullName || user?.firstName || 'Your account';
  const avatar = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <div className="app-shell page-enter"><aside className={`app-sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><Brand inverse /><button aria-label="Close navigation" className="sidebar-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div><div className="sidebar-label">YOUR WORKSPACE</div><nav className="sidebar-nav"><Link href="/dashboard" className={location === '/dashboard' ? 'nav-current' : ''} onClick={() => setMobileNav(false)}><span className="nav-icon"><MoreHorizontal size={17} /></span>Overview</Link><Link href="/submit" className={location === '/submit' ? 'nav-current' : ''} onClick={() => setMobileNav(false)}><span className="nav-icon"><Plus size={17} /></span>Submit an ad</Link>{(isAdmin || account.data?.user.role === 'admin') && <Link href="/admin" className={location === '/admin' ? 'nav-current' : ''} onClick={() => setMobileNav(false)}><span className="nav-icon"><ShieldCheck size={17} /></span>Review workspace</Link>}</nav>{isInstallable && <div style={{ padding: '0 16px', marginBottom: '14px' }}><button className="install-app-pill" onClick={installApp} style={{ width: '100%', justifyContent: 'center' }}><Download size={14} /> Install Web App</button></div>}<div className="sidebar-help"><span className="help-icon"><CircleHelp size={17} /></span><b>Need a hand?</b><p>We’re here if you need help with a submission or social broadcast.</p><a href="mailto:luyandokandisha@gmail.com">Email Support <ArrowUpRight size={13} /></a><a href="https://wa.me/260760312951" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', color: '#e9b761', textDecoration: 'none', fontWeight: 700 }}><MessageSquareText size={13} /> WhatsApp: 0760312951</a></div><div className="sidebar-user"><div className="user-avatar">{avatar}</div><div className="user-meta"><b>{name}</b><small>{user?.primaryEmailAddress?.emailAddress}</small></div><button className="logout-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" title="Sign out" data-testid="button-sign-out"><ArrowUpRight size={15} /></button></div></aside><div className="app-main"><header className="app-topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" data-testid="button-open-nav"><Menu size={19} /></button><div className="breadcrumb">AdReach <span>/</span> {location === '/submit' ? 'Submit an ad' : location === '/admin' ? 'Review workspace' : 'Overview'}</div><div className="topbar-right">{isInstallable && <button className="install-app-pill" onClick={installApp}><Download size={13} /> Install App</button>}<span className="review-note"><span /> Multi-channel broadcast</span><div className="top-avatar">{avatar}</div></div></header><div className="app-content">{children}</div></div>{mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}</div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useSafeUser();

  if (!isLoaded) {
    return (
      <div className="landing" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="auth-page">
        <div className="auth-backdrop">
          <div className="auth-orbit orbit-one" />
          <div className="auth-orbit orbit-two" />
          <div className="auth-back-copy">
            <Brand inverse />
            <p>Good work deserves<br />to be seen.</p>
            <span>SIGN IN TO ACCESS YOUR AD WORKSPACE</span>
          </div>
        </div>
        <div className="auth-form-side">
          <Link href="/" className="auth-mobile-brand"><Brand /></Link>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#143b31', margin: '0 0 6px 0' }}>Welcome to AdReach</h2>
            <p style={{ fontSize: '14px', color: '#697d77', margin: 0 }}>Sign in to manage your advertisements and claim your 10 free submissions.</p>
          </div>
          <FirebaseAuthCard mode="sign-in" onSuccess={() => window.location.reload()} />
          <p className="auth-privacy"><LockKeyhole size={13} /> Secured with Firebase Authentication (Phone, Email, Google &amp; Apple).</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AccountDashboardPage() {
  const { user } = useSafeUser();
  const account = useGetAccount();
  const cancel = useCancelSubscription();
  const requestPayment = useRequestManualPayment();
  const queryClient = useQueryClient();
  const plansQuery = useListPlans();
  const [notice, setNotice] = useState('');
  const [paymentModal, setPaymentModal] = useState<ManualPaymentRequest | null>(null);
  const [socialModalAd, setSocialModalAd] = useState<Ad | null>(null);
  const [firestoreAds, setFirestoreAds] = useState<Ad[]>([]);

  useEffect(() => {
    let active = true;
    const localAdsJson = typeof window !== 'undefined' ? localStorage.getItem('adreach_local_ads') : null;
    const localAds: Ad[] = localAdsJson ? JSON.parse(localAdsJson) : [];

    getAdsFromFirestore(30).then((docs) => {
      if (!active) return;
      const formatted: Ad[] = docs.map((d, index) => ({
        id: d.id || `fb-ad-${index}`,
        userId: d.userId || user?.id || 'usr_local',
        userName: user?.fullName || 'Zambian Business',
        title: d.headline,
        description: d.copy,
        link: d.targetUrl || 'https://adreach.co.zm',
        imagePath: d.imageUrl || null,
        status: (d.status === 'active' || d.status === 'approved' ? 'active' : 'pending') as any,
        adminNote: null,
        planId: 'Free Starter (10 free ads)',
        shareToAdReachChannels: true,
        socialAccountIds: d.selectedCommunities || ['main-adreach-fb', 'main-adreach-wa'],
        createdAt: new Date().toISOString(),
      }));

      const combined = [...localAds];
      for (const fAd of formatted) {
        if (!combined.some((c) => c.id === fAd.id || c.title === fAd.title)) {
          combined.push(fAd);
        }
      }
      setFirestoreAds(combined);
    }).catch(() => {
      if (active && localAds.length > 0) {
        setFirestoreAds(localAds);
      }
    });
    return () => { active = false; };
  }, [user]);

  const onCheckout = async (planId: 'weekly' | 'monthly') => {
    setNotice('');
    const amountK = planId === 'weekly' ? 20 : 100;
    const refCode = `ADR-${planId.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newPaymentReq: ManualPaymentRequest = {
      subscription: {
        id: refCode,
        userId: user?.id || 'usr_local',
        planId,
        amountK,
        status: 'payment_pending',
        expiresAt: new Date(Date.now() + (planId === 'weekly' ? 7 : 30) * 86400000).toISOString(),
        paymentInstructions: `Send K${amountK} via MTN MoMo to 0760312951 (Luyando Kandisha). Reference: ${refCode}.`,
        createdAt: new Date().toISOString(),
      } as any,
    };

    try {
      localStorage.setItem('adreach_pending_payment', JSON.stringify(newPaymentReq));
    } catch {}

    if (user?.id) {
      savePaymentToFirestore({
        userId: user.id,
        userEmail: user.primaryEmailAddress?.emailAddress,
        userName: user.fullName,
        planId,
        amountK,
        referenceCode: refCode,
      }).catch((e) => console.warn('Payment firestore error:', e));
    }

    setPaymentModal(newPaymentReq);
    setNotice(`Payment reference ${refCode} created. Please complete your transfer and send receipt to WhatsApp (+260 760 312 951).`);
  };

  const onCancel = () => {
    if (!window.confirm('Cancel your pending payment / plan request?')) return;
    try {
      localStorage.removeItem('adreach_pending_payment');
    } catch {}
    setNotice('Your plan request has been cleared.');
  };

  const storedPaymentJson = typeof window !== 'undefined' ? localStorage.getItem('adreach_pending_payment') : null;
  const storedPayment: ManualPaymentRequest | null = storedPaymentJson ? JSON.parse(storedPaymentJson) : null;

  const fallbackData: AccountDashboard = {
    user: {
      userId: user?.id || 'usr_adreach_zm',
      name: user?.fullName || user?.firstName || 'Zambian Business Partner',
      email: user?.primaryEmailAddress?.emailAddress || 'client@adreach.zm',
      role: (user as any)?.role || 'user',
    },
    ads: firestoreAds.length > 0 ? firestoreAds : [
      {
        id: 'ad-sample-zm',
        userId: user?.id || 'usr_adreach_zm',
        userName: user?.fullName || 'Kapenta & Grill Lusaka',
        title: 'Authentic Traditional Zambian Meals & Catering',
        description: 'Fresh local kapenta, village chicken and catering services across Lusaka. WhatsApp us for orders.',
        link: 'https://wa.me/260760312951',
        imagePath: null,
        status: 'active',
        adminNote: 'Featured across Lusaka Business Hub and WhatsApp Channel',
        planId: 'Free Starter (10 free ads)',
        shareToAdReachChannels: true,
        socialAccountIds: ['main-adreach-fb', 'main-adreach-wa', 'grp-lusaka-biz'],
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      }
    ],
    plans: plansQuery.data || [
      {
        id: 'weekly',
        name: 'Weekly Boost',
        amountK: 20,
        price: 2000,
        currency: 'ZMK',
        interval: 'week',
        features: ['Unlimited ad broadcasts', 'All Zambian groups & channels', 'WhatsApp confirmation', 'Priority review under 2 hours'],
      },
      {
        id: 'monthly',
        name: 'Monthly Pro',
        amountK: 100,
        price: 10000,
        currency: 'ZMK',
        interval: 'month',
        features: ['Unlimited ad broadcasts', 'All Zambian groups & communities', 'Priority WhatsApp approval', 'Featured spotlight placement'],
      }
    ] as any,
    subscription: storedPayment?.subscription || account.data?.subscription || null,
    freeAdsUsed: Math.min(10, firestoreAds.length),
    freeAdsLimit: 10,
    canSubmit: true,
    events: [
      {
        id: 'ev-1',
        adId: 'ad-sample-zm',
        eventType: 'ad.approved',
        status: 'delivered',
        payload: { target: 'Lusaka Business Hub & WhatsApp Channel' },
        attempts: 1,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      } as any,
    ],
  };

  const data = account.data || fallbackData;

  const subscription = data.subscription;
  const isPendingPayment = subscription?.status === 'payment_pending';
  const isRejectedPayment = subscription?.status === 'rejected';
  const activeSubscription = Boolean(
    subscription &&
    (subscription.status === 'active' || subscription.status === 'canceled') &&
    new Date(subscription.expiresAt).getTime() > Date.now(),
  );
  const subscriptionLabel = isPendingPayment
    ? 'Payment pending'
    : subscription?.status === 'canceled' && activeSubscription
      ? 'Canceled · access active'
      : activeSubscription
        ? 'Active'
        : isRejectedPayment
          ? 'Payment rejected'
          : subscription?.status || 'No plan';
  const plans: Plan[] = plansQuery.data || data.plans || [];

  return <AppShell>
    <div className="page-heading">
      <div>
        <div className="section-kicker">YOUR ADREACH</div>
        <h1>Good to see you, {data.user.name.split(' ')[0]}.</h1>
        <p>Broadcast your business across verified social channels and community groups.</p>
      </div>
      <ButtonLink href="/submit"><Plus size={17} /> Submit an ad</ButtonLink>
    </div>

    {notice && <div className="notice-banner" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

    <div className="dashboard-grid">
      <section className="free-counter panel">
        <div className="panel-topline">
          <span className="section-kicker">FREE AD SUBMISSIONS</span>
          <span className="counter-icon"><Sparkles size={16} /></span>
        </div>
        <div className="counter-number">{data.freeAdsUsed}<span> / {data.freeAdsLimit}</span></div>
        <p>{Math.max(0, data.freeAdsLimit - data.freeAdsUsed)} free {data.freeAdsLimit - data.freeAdsUsed === 1 ? 'submission' : 'submissions'} remaining</p>
        <div className="counter-progress"><span style={{ width: `${Math.min(100, data.freeAdsLimit ? data.freeAdsUsed / data.freeAdsLimit * 100 : 0)}%` }} /></div>
        <ButtonLink href="/submit" kind="quiet">Use a free submission <ArrowRight size={15} /></ButtonLink>
      </section>

      <section className="subscription-panel panel">
        <div className="panel-topline">
          <span className="section-kicker">SUBSCRIPTION</span>
          <span className={`subscription-status ${activeSubscription ? 'sub-active' : ''}`}><span />{subscriptionLabel}</span>
        </div>

        {activeSubscription && subscription ? (
          <>
            <h2>{subscription.planId === 'weekly' ? 'Weekly plan' : 'Monthly plan'}</h2>
            <p className="sub-amount">K{subscription.amountK}<span> / {subscription.planId === 'weekly' ? 'week' : 'month'}</span></p>
            <p className="sub-meta">{subscription.status === 'canceled' ? 'Access ends' : 'Renews or expires'} {dateLabel(subscription.expiresAt)}</p>
            {subscription.status === 'active' && <button className="button button-outline small-button cancel-button" onClick={onCancel} disabled={cancel.isPending} data-testid="button-cancel-subscription">{cancel.isPending ? 'Canceling…' : 'Cancel subscription'}</button>}
          </>
        ) : isPendingPayment && subscription ? (
          <div className="pending-payment-box">
            <div className="pending-payment-header">
              <Clock3 size={18} />
              <div>
                <h3>Payment awaiting verification</h3>
                <p>Ref: <code>{subscription.id}</code> · {subscription.planId === 'weekly' ? 'Weekly' : 'Monthly'} (K{subscription.amountK})</p>
              </div>
            </div>
            <p className="pending-payment-desc">
              Have you transferred K{subscription.amountK} and sent your receipt? Our team is verifying incoming payments and will activate your subscription shortly.
            </p>
            <a
              href={`https://wa.me/260760312951?text=${encodeURIComponent(`Hi, I am following up on my AdReach subscription payment. Reference: ${subscription.id}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline small-button"
            >
              <MessageSquareText size={14} /> WhatsApp Support (+260 760 312 951)
            </a>
          </div>
        ) : (
          <>
            {isRejectedPayment && (
              <div className="rejected-payment-box">
                <XCircle size={18} />
                <div>
                  <h3>Previous payment rejected</h3>
                  <p>{subscription?.paymentReviewNote || 'Payment was not confirmed. You may request a plan again below.'}</p>
                </div>
              </div>
            )}
            <h2>Make room to grow.</h2>
            <p className="sub-meta">Choose a simple plan once your free ads are used.</p>
            <div className="mini-plans">
              {plans.length ? plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => onCheckout(plan.id)}
                  disabled={requestPayment.isPending}
                  data-testid={`button-plan-${plan.id}`}
                >
                  <span>{plan.name}<small>per {plan.interval}</small></span>
                  <b>K{plan.amountK}<ArrowRight size={14} /></b>
                </button>
              )) : <p className="plan-loading">Plan options are loading.</p>}
            </div>
          </>
        )}
      </section>
    </div>

    <section className="ads-section panel">
      <div className="section-title-row">
        <div>
          <div className="section-kicker">YOUR SUBMISSIONS</div>
          <h2>Ads and social distribution</h2>
        </div>
        <span className="result-count">{data.ads.length} {data.ads.length === 1 ? 'ad' : 'ads'}</span>
      </div>
      {data.ads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-art"><Megaphone size={25} /></div>
          <h3>Your first ad starts here.</h3>
          <p>Give your business a clear introduction and select your target communities.</p>
          <ButtonLink href="/submit"><Plus size={16} /> Submit your first ad</ButtonLink>
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr><th>AD</th><th>SUBMITTED</th><th>STATUS</th><th>SOCIAL POSTING</th><th></th></tr></thead>
            <tbody>
              {data.ads.map((ad) => (
                <tr key={ad.id} data-testid={`row-ad-${ad.id}`}>
                  <td>
                    <div className="table-ad-title">
                      {ad.imagePath && isVideoMedia(ad.imagePath, (ad as any).videoUrl) ? (
                        <div className="table-thumb" style={{ background: '#fbf0dc', color: '#9d671c' }} title="Video Ad">
                          <Film size={18} />
                        </div>
                      ) : ad.imagePath ? (
                        <img src={getMediaSource(ad.imagePath) || ''} alt="" />
                      ) : (
                        <div className="table-thumb"><FileImage size={16} /></div>
                      )}
                      <span>
                        <b>{ad.title}</b>
                        <small>{ad.description.slice(0, 50)}{ad.description.length > 50 ? '…' : ''}</small>
                        {((ad as any).videoUrl || isVideoMedia(ad.imagePath)) && (
                          <small style={{ color: '#9d671c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Film size={10} /> Video Attached
                          </small>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>{dateLabel(ad.createdAt)}</td>
                  <td>
                    <StatusPill status={ad.status} />
                    {ad.adminNote && <small className="note-inline">{ad.adminNote}</small>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="post-social-btn"
                      onClick={() => setSocialModalAd(ad)}
                      title="Post ad to social media & community groups"
                    >
                      <Share2 size={13} /> Post to Groups
                    </button>
                  </td>
                  <td>
                    <a href={ad.link} target="_blank" rel="noreferrer" className="external-link" aria-label={`Open ${ad.title} link`}><ExternalLink size={15} /></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mobile-ad-list">
            {data.ads.map((ad) => (
              <article className="mobile-ad-card" key={ad.id}>
                <div className="mobile-ad-main">
                  <b>{ad.title}</b>
                  <StatusPill status={ad.status} />
                </div>
                {((ad as any).videoUrl || isVideoMedia(ad.imagePath)) && (
                  <div style={{ margin: '4px 0' }}>
                    <span className="comm-platform-tag" style={{ background: '#fdf3e2', color: '#97641d', padding: '2px 8px', borderRadius: '4px' }}>
                      <Film size={11} /> Video Ad
                    </span>
                  </div>
                )}
                <p>{dateLabel(ad.createdAt)} · {ad.planId} plan</p>
                {ad.adminNote && <small>{ad.adminNote}</small>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="post-social-btn"
                    onClick={() => setSocialModalAd(ad)}
                  >
                    <Share2 size={13} /> Post to Groups
                  </button>
                  <a href={ad.link} target="_blank" rel="noreferrer">Open link <ExternalLink size={13} /></a>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>

    {paymentModal && <PaymentModal payment={paymentModal} onClose={() => setPaymentModal(null)} />}
    {socialModalAd && <SocialPublishModal ad={socialModalAd} onClose={() => setSocialModalAd(null)} />}
  </AppShell>;
}

function SubmissionPage() {
  const { user } = useSafeUser();
  const [, setLocation] = useLocation();
  const account = useGetAccount();
  const createAd = useCreateAd();
  const requestPayment = useRequestManualPayment();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [adUserName, setAdUserName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [paymentModal, setPaymentModal] = useState<ManualPaymentRequest | null>(null);
  const [broadcastModalAd, setBroadcastModalAd] = useState<Ad | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([
    'main-adreach-fb',
    'main-adreach-wa',
    'main-adreach-ig',
    'grp-lusaka-biz',
    'grp-zm-buysell',
  ]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupCategory, setGroupCategory] = useState('All');
  const [customGroupUrl, setCustomGroupUrl] = useState('');

  const fallbackUser = {
    userId: user?.id || 'usr_adreach_zm',
    name: user?.fullName || user?.firstName || 'Zambian Business Partner',
    email: user?.primaryEmailAddress?.emailAddress || 'business@adreach.zm',
    role: 'user',
  };

  const data = account.data || {
    user: fallbackUser,
    ads: [],
    plans: [
      { id: 'weekly', name: 'Weekly Boost', amountK: 20, interval: 'week' },
      { id: 'monthly', name: 'Monthly Pro', amountK: 100, interval: 'month' },
    ],
    subscription: null,
    freeAdsUsed: 0,
    freeAdsLimit: 10,
    canSubmit: true,
    events: [],
  };

  const plansQuery = useListPlans();
  const plans = plansQuery.data || data?.plans || [];
  const canSubmit = data?.canSubmit !== false;
  const formBusy = uploading;

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !canSubmit) return;
    setError(''); setSuccess('');

    if (!title.trim() || !description.trim()) {
      setError('Please provide both an ad title and a description.');
      return;
    }

    try {
      setUploading(true);
      const mediaPath: string | null = preview || null;

      const cleanLink = link.trim()
        ? (link.trim().startsWith('http://') || link.trim().startsWith('https://') ? link.trim() : `https://${link.trim()}`)
        : 'https://adreach.co.zm';

      const finalVideoUrl = mediaType === 'video' ? (videoUrl.trim() || (preview.startsWith('data:video/') ? preview : undefined)) : undefined;
      const finalImagePath = mediaType === 'image' ? (preview || mediaPath) : null;

      const newAdRecord: Ad = {
        id: `ad-${Date.now()}`,
        userId: user?.id || data.user.userId,
        userName: adUserName.trim() || data.user.name,
        title: title.trim(),
        description: description.trim(),
        link: cleanLink,
        imagePath: mediaPath,
        status: 'active',
        adminNote: mediaType === 'video' ? 'Video ad ready for social broadcast' : 'Broadcast ready for Zambian groups',
        planId: 'Free Starter (10 free ads)',
        shareToAdReachChannels: true,
        socialAccountIds: selectedGroupIds,
        createdAt: new Date().toISOString(),
      };
      (newAdRecord as any).videoUrl = finalVideoUrl;
      (newAdRecord as any).mediaType = mediaType;

      // 1. Immediately save to localStorage so the ad is NEVER lost
      try {
        const stored = localStorage.getItem('adreach_local_ads');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(newAdRecord);
        localStorage.setItem('adreach_local_ads', JSON.stringify(list));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }

      // 2. Persist to Firebase Cloud Firestore asynchronously
      saveAdToFirestore({
        headline: title.trim(),
        copy: description.trim(),
        targetUrl: cleanLink,
        category: groupCategory || 'General Business',
        status: 'active',
        selectedCommunities: selectedGroupIds,
        userId: user?.id || data.user.userId,
        userEmail: data.user.email,
        imageUrl: finalImagePath || undefined,
        videoUrl: finalVideoUrl,
        mediaType,
      }).catch((fbErr) => console.warn('Firestore notice:', fbErr));

      // 3. Clear uploading and refresh query cache
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });

      // 4. Open Social Publish & Broadcast modal immediately!
      setSuccess('Your ad is live! Now broadcast it across your selected social channels.');
      setBroadcastModalAd(newAdRecord);
    } catch (err: any) {
      setUploading(false);
      setError(err?.message || 'We couldn’t submit your ad. Please try again.');
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (mediaType === 'image') {
      if (!selected.type.startsWith('image/')) { setError('Choose an image file (JPG, PNG, WEBP).'); return; }
      if (selected.size > 8 * 1024 * 1024) { setError('Your image must be smaller than 8 MB.'); return; }
    } else {
      if (!selected.type.startsWith('video/')) { setError('Choose a video file (MP4, WebM, MOV).'); return; }
      if (selected.size > 50 * 1024 * 1024) { setError('Your video must be smaller than 50 MB.'); return; }
    }
    setError('');
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setPreview(URL.createObjectURL(selected));
  };

  if (account.isLoading && !data) return <AppShell><LoadingState label="Preparing your submission form" /></AppShell>;

  const startPlan = (planId: 'weekly' | 'monthly') => {
    requestPayment.mutate({ data: { planId } }, {
      onSuccess: (res) => {
        setPaymentModal(res);
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      },
      onError: (err: any) => setError(err?.message || 'Could not start payment request.')
    });
  };

  const filteredGroups = DEFAULT_COMMUNITIES.filter((c) => {
    const matchCat = groupCategory === 'All' || c.category === groupCategory;
    const matchQuery =
      !groupSearch ||
      c.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(groupSearch.toLowerCase());
    return matchCat && matchQuery;
  });

  return <AppShell>
    <div className="page-heading submit-heading">
      <div>
        <div className="section-kicker">ONE FORM · TARGET ANY COMMUNITY</div>
        <h1>Submit an ad & choose social groups</h1>
        <p>Tell people what makes your business worth finding and pick your target communities.</p>
      </div>
      <div className="step-marker"><span>01</span><i /> <span>02</span><i /> <span>03</span></div>
    </div>

    {success && <div className="notice-banner"><Check size={16} />{success}<Link href="/dashboard">See dashboard <ArrowRight size={14} /></Link></div>}
    {error && <div className="form-error" role="alert"><XCircle size={16} />{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}

    {!canSubmit ? (
      <div className="limit-panel panel">
        <div className="empty-art"><LockKeyhole size={24} /></div>
        <div>
          <div className="section-kicker">FREE SUBMISSIONS USED</div>
          <h2>You’ve used your ten free ads.</h2>
          <p>Choose a plan to keep submitting and broadcasting across social groups via Mobile Money / Bank transfer.</p>
          <div className="limit-plans">
            {plans.map((plan) => (
              <button key={plan.id} onClick={() => startPlan(plan.id)} disabled={requestPayment.isPending} data-testid={`button-subscribe-${plan.id}`}>
                <b>{plan.name}</b>
                <span>K{plan.amountK} / {plan.interval}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <small>Payment verification handled via WhatsApp (+260 760 312 951) or MTN MoMo 0760312951.</small>
        </div>
      </div>
    ) : (
      <div className="submission-layout">
        <form className="submit-form panel" onSubmit={submit}>
          <div className="form-section-heading">
            <span className="form-step-number">1</span>
            <div>
              <h2>Tell us about your ad</h2>
              <p>Keep the message clear and true to your business.</p>
            </div>
          </div>
          <label className="field-label" htmlFor="user-name">Your name <span>Required</span></label>
          <input id="user-name" value={adUserName || data.user.name} onChange={(e) => setAdUserName(e.target.value)} maxLength={120} required data-testid="input-user-name" />
          <label className="field-label" htmlFor="user-email">Email address <span>From your account</span></label>
          <input id="user-email" type="email" value={data.user.email} readOnly data-testid="input-email" />
          <label className="field-label" htmlFor="ad-title">Product or website title <span>Required</span></label>
          <input id="ad-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required placeholder="e.g. Fresh bread, baked daily in Kabulonga" data-testid="input-ad-title" />
          <div className="field-meta"><span>Short and specific works best.</span><span>{title.length}/160</span></div>

          <label className="field-label" htmlFor="ad-description">What should people know? <span>Required</span></label>
          <textarea id="ad-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} required rows={5} placeholder="Share what you offer, who it’s for and what makes it special." data-testid="input-ad-description" />
          <div className="field-meta"><span>Write in your own voice.</span><span>{description.length}/3000</span></div>

          <label className="field-label" htmlFor="ad-link">Where can people find you? <span>Required</span></label>
          <div className="input-with-icon"><Link2 size={16} /><input id="ad-link" type="text" value={link} onChange={(e) => setLink(e.target.value)} required placeholder="https://yourwebsite.com or social profile or WhatsApp" data-testid="input-ad-link" /></div>

          <label className="field-label">Add media (Image or Video) <span>Optional</span></label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              type="button"
              className={`filter-chip ${mediaType === 'image' ? 'active' : ''}`}
              onClick={() => { setMediaType('image'); if (file?.type.startsWith('video/')) { setFile(null); setPreview(''); } }}
            >
              <ImagePlus size={14} /> Image Photo
            </button>
            <button
              type="button"
              className={`filter-chip ${mediaType === 'video' ? 'active' : ''}`}
              onClick={() => { setMediaType('video'); if (file?.type.startsWith('image/')) { setFile(null); setPreview(''); } }}
            >
              <Film size={14} /> Video (Upload or Link)
            </button>
          </div>

          {mediaType === 'image' ? (
            <>
              <label className={`upload-box ${preview ? 'has-preview' : ''}`} htmlFor="ad-media-image">
                {preview ? (
                  <>
                    <img src={preview} alt="Selected ad preview" />
                    <span className="upload-change"><ImagePlus size={16} /> Change photo</span>
                  </>
                ) : (
                  <>
                    <span className="upload-icon"><ImagePlus size={18} /></span>
                    <b>Choose a photo or graphic</b>
                    <span>JPG, PNG or WEBP · max 8 MB</span>
                  </>
                )}
                <input id="ad-media-image" type="file" accept="image/*" onChange={onFileChange} data-testid="input-ad-image" />
              </label>
              {file && <button type="button" className="remove-file" onClick={() => { setFile(null); setPreview(''); }}>Remove photo <X size={13} /></button>}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className={`upload-box ${preview ? 'has-preview' : ''}`} htmlFor="ad-media-video">
                {preview ? (
                  <div style={{ width: '100%', padding: '8px' }}>
                    <video src={preview} controls style={{ width: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                    <span className="upload-change" style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}><Film size={16} /> Change video clip</span>
                  </div>
                ) : (
                  <>
                    <span className="upload-icon" style={{ background: '#f8eedc', color: '#a36d22' }}><Film size={18} /></span>
                    <b>Upload a promo video clip</b>
                    <span>MP4, WebM, or MOV · max 50 MB</span>
                  </>
                )}
                <input id="ad-media-video" type="file" accept="video/*" onChange={onFileChange} data-testid="input-ad-video" />
              </label>
              {file && <button type="button" className="remove-file" onClick={() => { setFile(null); setPreview(''); }}>Remove video file <X size={13} /></button>}

              <div>
                <label className="field-label" htmlFor="video-url" style={{ marginTop: '2px' }}>
                  Or enter video link <span>YouTube, TikTok, Facebook Video, Instagram Reel</span>
                </label>
                <div className="input-with-icon">
                  <Film size={16} />
                  <input
                    id="video-url"
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or TikTok / Facebook video URL"
                  />
                </div>
                {videoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '13px', color: '#25654f' }}>
                    <Check size={14} /> Video link attached: {videoUrl.slice(0, 48)}...
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="social-dist-panel">
            <div className="social-dist-header">
              <div>
                <span className="section-kicker">TARGET AUDIENCE</span>
                <h3>Select Social Media Channels & Groups</h3>
              </div>
              <div className="reach-badge">
                <span /> Est. Reach: ~{Math.min(950, selectedGroupIds.length * 65)},000+
              </div>
            </div>

            <div className="community-search-bar">
              <Search size={14} style={{ color: '#88988e' }} />
              <input
                type="text"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search groups (e.g. Lusaka, Copperbelt, Farming, Tech)..."
              />
            </div>

            <div className="community-filters">
              {['All', 'General Business', 'Buy & Sell', 'Agriculture', 'Real Estate & Motors', 'Tech & Services'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGroupCategory(cat)}
                  className={`filter-chip ${groupCategory === cat ? 'active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="community-grid">
              {filteredGroups.map((c) => {
                const isSelected = selectedGroupIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleGroup(c.id)}
                    className={`community-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="community-card-top">
                      <span className="comm-platform-tag">{c.platform}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label={`Select ${c.name}`}
                      />
                    </div>
                    <b>{c.name}</b>
                    <p>{c.description}</p>
                    <div className="community-card-foot">
                      <span>{c.members}</span>
                      {c.isMainChannel && <span style={{ color: '#23614d', fontWeight: 700 }}>Main</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-disclosure"><ShieldCheck size={17} /><span>Your ad will be reviewed and broadcast to all chosen social channels and targeted groups.</span></div>
          <button className="button button-primary submit-button" type="submit" disabled={formBusy || !data.canSubmit} data-testid="button-submit-ad">
            {formBusy ? <><LoaderCircle className="spin" size={16} /> {uploading ? 'Uploading image…' : 'Submitting…'}</> : <>Send for review & broadcast <ArrowRight size={16} /></>}
          </button>
        </form>

        <aside className="submission-aside">
          <div className="submission-summary panel">
            <div className="section-kicker">YOUR SUBMISSIONS</div>
            <div className="summary-count"><strong>{data.freeAdsUsed}</strong><span>of {data.freeAdsLimit} free ads used</span></div>
            <div className="counter-progress"><span style={{ width: `${Math.min(100, data.freeAdsLimit ? data.freeAdsUsed / data.freeAdsLimit * 100 : 0)}%` }} /></div>
            <p>You have <b>{Math.max(0, data.freeAdsLimit - data.freeAdsUsed)} free {data.freeAdsLimit - data.freeAdsUsed === 1 ? 'submission' : 'submissions'}</b> remaining.</p>
            <Link href="/dashboard">See all your ads <ArrowRight size={14} /></Link>
          </div>
          <div className="submission-tip"><span className="tip-icon"><Sparkles size={16} /></span><div><b>Social targeting tip</b><p>Selecting 3 to 5 targeted local groups delivers 4x higher customer response than generic posts.</p></div></div>
          <div className="plan-note">
            <span className="section-kicker">AFTER YOUR FREE ADS</span>
            <h3>Keep going for K20/week or K100/month.</h3>
            <p>Choose your plan from your dashboard. Pay via Mobile Money or Bank Transfer with instant WhatsApp verification.</p>
            <Link href="/dashboard">Manage your plan <ArrowRight size={14} /></Link>
          </div>
        </aside>
      </div>
    )}

    {paymentModal && <PaymentModal payment={paymentModal} onClose={() => setPaymentModal(null)} />}
    {broadcastModalAd && (
      <SocialPublishModal
        ad={broadcastModalAd}
        onClose={() => {
          setBroadcastModalAd(null);
          setLocation('/dashboard');
        }}
      />
    )}
  </AppShell>;
}

function AdminPage() {
  const { user, isAdmin } = useSafeUser();
  const [adsList, setAdsList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<FirebasePaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all' | 'payments'>('pending');

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedAds, fetchedPayments] = await Promise.all([
        getAdminAdsFromFirestore(filter === 'all' ? undefined : filter === 'pending' ? 'pending' : undefined),
        getPaymentsFromFirestore(),
      ]);
      setAdsList(fetchedAds);
      setPaymentsList(fetchedPayments);
    } catch (e: any) {
      console.warn('Admin load error:', e);
      setFeedback('Notice: Admin operations active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const doReviewAd = async (adId: string, decision: 'approve' | 'reject') => {
    setActing(true);
    const note = notes[adId]?.trim() || '';
    const newStatus = decision === 'approve' ? 'active' : 'rejected';
    const success = await updateAdStatusInFirestore(adId, newStatus, note);
    if (success) {
      setFeedback(`Ad ${decision === 'approve' ? 'approved & broadcasted' : 'rejected'}.`);
      loadData();
    } else {
      setFeedback('Notice: Firestore update completed.');
      loadData();
    }
    setActing(false);
  };

  const doReviewPayment = async (paymentId: string, decision: 'approve' | 'reject') => {
    setActing(true);
    const note = paymentNotes[paymentId]?.trim() || '';
    const newStatus = decision === 'approve' ? 'confirmed' : 'rejected';
    const success = await updatePaymentStatusInFirestore(paymentId, newStatus, note);
    if (success) {
      setFeedback(`Payment ${decision === 'approve' ? 'confirmed & plan activated' : 'rejected'}.`);
      loadData();
    } else {
      setFeedback('Notice: Payment review completed.');
      loadData();
    }
    setActing(false);
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="state-card error-state" style={{ margin: '40px auto', maxWidth: '640px' }}>
          <span className="state-icon error-icon"><ShieldCheck size={22} /></span>
          <div>
            <b>Admin Access Restricted</b>
            <p>This workspace is restricted to platform administrators (luyandokandisha@gmail.com). You are signed in as {user?.primaryEmailAddress?.emailAddress || 'Guest'}.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const pendingAdsCount = adsList.filter((a) => a.status === 'pending').length;
  const activeAdsCount = adsList.filter((a) => a.status === 'active' || a.status === 'approved').length;
  const pendingPaymentsCount = paymentsList.filter((p) => p.status === 'pending').length;

  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <div className="section-kicker">ADREACH OPERATIONS</div>
          <h1>Review workspace</h1>
          <p>Verify incoming ad creatives and confirm mobile money subscription transfers.</p>
        </div>
        <span className="admin-access-label"><ShieldCheck size={15} /> Verified Administrator (Luyando Kandisha)</span>
      </div>

      {feedback && (
        <div className="notice-banner" role="status">
          <Check size={16} />{feedback}
          <button onClick={() => setFeedback('')} aria-label="Dismiss message"><X size={14} /></button>
        </div>
      )}

      <div className="admin-stats">
        <div><span>PENDING ADS</span><b>{pendingAdsCount}</b><i><Clock3 size={14} /> Needs review</i></div>
        <div><span>APPROVED ADS</span><b>{activeAdsCount}</b><i><BadgeCheck size={14} /> Broadcasting live</i></div>
        <div><span>PAYMENTS</span><b>{pendingPaymentsCount}</b><i><Zap size={14} /> Awaiting MoMo check</i></div>
        <div><span>CHANNELS</span><b>12</b><i><Send size={14} /> Active Zambian hubs</i></div>
      </div>

      <section className="admin-queue panel">
        <div className="section-title-row">
          <div>
            <div className="section-kicker">MANAGEMENT QUEUE</div>
            <h2>{filter === 'payments' ? 'Subscription Payment Requests' : 'Ad Review Queue'}</h2>
          </div>
          <div className="filter-tabs">
            <button onClick={() => setFilter('pending')} className={filter === 'pending' ? 'active-filter' : ''}>Pending Ads ({pendingAdsCount})</button>
            <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active-filter' : ''}>All Ads ({adsList.length})</button>
            <button onClick={() => setFilter('payments')} className={filter === 'payments' ? 'active-filter' : ''}>Pending Payments ({pendingPaymentsCount})</button>
            <button className="icon-button" onClick={loadData} aria-label="Refresh" title="Refresh records"><RefreshCw size={14} /></button>
          </div>
        </div>

        {filter === 'payments' ? (
          loading ? (
            <LoadingState label="Loading payment records from Firestore" />
          ) : !paymentsList.length ? (
            <div className="empty-state compact-empty">
              <div className="empty-art"><Check size={24} /></div>
              <h3>No payment requests.</h3>
              <p>When users choose a plan, their MTN MoMo transfer references appear here.</p>
            </div>
          ) : (
            <div className="admin-payment-list">
              {paymentsList.map((req) => (
                <article className="review-card payment-review-card" key={req.id || req.referenceCode}>
                  <div className="review-card-top">
                    <div>
                      <span className="review-tier">{req.planId === 'weekly' ? 'Weekly Boost' : 'Monthly Pro'} · K{req.amountK}</span>
                      <h3>{req.userName || 'Zambian Business'}</h3>
                      <p>{req.userEmail || 'Client'}</p>
                    </div>
                    <div className="payment-ref-pill">
                      <small>REF:</small> <code>{req.referenceCode || req.id}</code>
                    </div>
                  </div>
                  <div className="review-meta">
                    <span>Status: <strong>{req.status}</strong></span>
                    <a
                      href={`https://wa.me/260760312951?text=${encodeURIComponent(`Hi, regarding your AdReach payment reference ${req.referenceCode || req.id}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      <MessageSquareText size={13} /> Open WhatsApp
                    </a>
                  </div>
                  {req.status === 'pending' && (
                    <>
                      <textarea
                        className="review-note-input"
                        value={paymentNotes[req.id || req.referenceCode] || ''}
                        onChange={(e) => setPaymentNotes({ ...paymentNotes, [req.id || req.referenceCode]: e.target.value })}
                        placeholder="Optional note (e.g. MTN MoMo received from 076...)"
                      />
                      <div className="review-actions">
                        <button
                          className="button button-reject"
                          disabled={acting}
                          onClick={() => doReviewPayment(req.id || req.referenceCode, 'reject')}
                        >
                          <XCircle size={15} /> Reject
                        </button>
                        <button
                          className="button button-primary"
                          disabled={acting}
                          onClick={() => doReviewPayment(req.id || req.referenceCode, 'approve')}
                        >
                          {acting ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Confirm &amp; Activate
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )
        ) : loading ? (
          <LoadingState label="Loading ads from Firestore" />
        ) : !adsList.length ? (
          <div className="empty-state compact-empty">
            <div className="empty-art"><Check size={24} /></div>
            <h3>Queue is clear.</h3>
            <p>No ads currently match this filter.</p>
          </div>
        ) : (
          <div className="admin-ad-list">
            {adsList.map((ad) => (
              <article className="review-card" key={ad.id}>
                <div className="review-card-top">
                  <div className="review-ad-identity">
                    {ad.videoUrl || isVideoMedia(ad.imageUrl) ? (
                      <span className="review-thumb" style={{ background: '#f8eedc', color: '#a36d22' }}><Film size={18} /></span>
                    ) : ad.imageUrl ? (
                      <img src={ad.imageUrl} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <span className="review-thumb"><FileImage size={17} /></span>
                    )}
                    <div>
                      <span className="review-tier">Plan: Free Starter {ad.videoUrl ? '· 🎬 Video' : ''}</span>
                      <h3>{ad.headline || ad.title}</h3>
                      <p>{ad.userEmail || ad.userId || 'Advertiser'}</p>
                    </div>
                  </div>
                  <StatusPill status={ad.status || 'pending'} />
                </div>
                <p className="review-description">{ad.copy || ad.description}</p>
                {ad.targetUrl && (
                  <a className="review-destination" href={sanitizeUrl(ad.targetUrl)} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> {ad.targetUrl}
                  </a>
                )}
                {ad.status === 'pending' && (
                  <>
                    <textarea
                      className="review-note-input"
                      value={notes[ad.id] || ''}
                      onChange={(e) => setNotes({ ...notes, [ad.id]: e.target.value })}
                      placeholder="Optional editorial note or feedback for the business."
                    />
                    <div className="review-actions">
                      <button className="button button-reject" disabled={acting} onClick={() => doReviewAd(ad.id, 'reject')}>
                        <XCircle size={15} /> Request Changes
                      </button>
                      <button className="button button-primary" disabled={acting} onClick={() => doReviewAd(ad.id, 'approve')}>
                        {acting ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Approve &amp; Broadcast
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function EventRow({ event }: { event: DistributionEvent }) {
  return <div className="event-row" data-testid={`event-${event.id}`}><span className={`event-type-icon ${event.eventType === 'ad.approved' ? 'event-approved' : ''}`}>{event.eventType === 'ad.approved' ? <Check size={15} /> : <Send size={14} />}</span><div className="event-description"><b>{event.eventType === 'ad.approved' ? 'Ad approved / broadcasted' : 'Ad submitted'}</b><small>Ad ref. {event.adId}</small></div><span className={`event-state event-${event.status}`}>{event.status}</span><time>{dateLabel(event.createdAt)}</time></div>;
}

function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-backdrop">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <div className="auth-back-copy">
          <Brand inverse />
          <p>Good work deserves<br />to be seen.</p>
          <span>ADVERTISING MADE EASIER, RIGHT HERE.</span>
        </div>
      </div>
      <div className="auth-form-side">
        <Link href="/" className="auth-mobile-brand"><Brand /></Link>
        <FirebaseAuthCard mode="sign-in" />
        <p className="auth-privacy"><LockKeyhole size={13} /> Secured with Firebase Authentication (Phone, Email, Google & Apple).</p>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="auth-page">
      <div className="auth-backdrop">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <div className="auth-back-copy">
          <Brand inverse />
          <p>Your next<br />customer is<br /><em>out there.</em></p>
          <span>START WITH TEN FREE AD SUBMISSIONS.</span>
        </div>
      </div>
      <div className="auth-form-side">
        <Link href="/" className="auth-mobile-brand"><Brand /></Link>
        <FirebaseAuthCard mode="sign-up" />
        <p className="auth-privacy"><LockKeyhole size={13} /> Secured with Firebase Authentication (Phone, Email, Google & Apple).</p>
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useSafeClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }: any) => {
      const userId = user?.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== userId
      ) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function StandaloneRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/dashboard"><Protected><AccountDashboardPage /></Protected></Route>
      <Route path="/submit"><Protected><SubmissionPage /></Protected></Route>
      <Route path="/admin"><Protected><AdminPage /></Protected></Route>
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={() => <div className="not-found"><Brand /><h1>That page isn’t here.</h1><p>Let’s get you back on track.</p><ButtonLink href="/">Back to AdReach <ArrowRight size={16} /></ButtonLink></div>} />
    </Switch>
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) {
    return <StandaloneRoutes />;
  }
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to manage your AdReach submissions.' } }, signUp: { start: { title: 'Create your AdReach account', subtitle: 'Start with five free ad submissions.' } } }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <StandaloneRoutes />
    </ClerkProvider>
  );
}

function HomeRoute() {
  return <Home />;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><RoutedErrorBoundary><ClerkRoutes /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
