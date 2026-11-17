import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, CircleHelp,
  Clock3, Copy, ExternalLink, FileImage, ImagePlus, Instagram, Link2, LoaderCircle, LockKeyhole,
  Menu, Megaphone, MessageSquareText, MoreHorizontal, Plus, RefreshCw, Send, ShieldCheck,
  Sparkles, X, XCircle, Zap,
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

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }

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
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="site-header"><div className="nav-wrap"><Brand /><nav className={`public-nav ${menuOpen ? 'is-open' : ''}`}><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a><a href="#faq" onClick={() => setMenuOpen(false)}>FAQs</a></nav><div className="nav-actions"><Link href="/sign-in" className="signin-link">Sign in</Link><ButtonLink href="/sign-up" className="nav-cta">Start for free <ArrowRight size={15} /></ButtonLink></div><button className="menu-toggle" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)} data-testid="button-menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div></header>;
}
function Home() {
  return <div className="landing page-enter"><Header /><main>
    <section className="hero">
      <div className="hero-left"><div className="eyebrow"><span className="eyebrow-dot" /> MADE FOR ZAMBIAN BUSINESSES</div><h1>Good work<br />deserves to be<br /><span>seen.</span></h1><p className="hero-copy">Submit your ad once, get featured across all our social media channels.</p><div className="hero-actions"><ButtonLink href="/sign-up">Get your first 5 ads free <ArrowRight size={17} /></ButtonLink><a href="#how-it-works" className="text-link">See how it works <ArrowDownRight size={15} /></a></div><div className="hero-proof"><div className="proof-avatars"><span>MK</span><span>LK</span><span>CN</span></div><span>For the people building Zambia.</span></div></div>
      <div className="hero-art"><div className="art-sun" /><div className="art-caption"><span>LOCAL BUSINESS</span><span>01 / 03</span></div><div className="art-phone"><div className="phone-top"><span className="mini-avatar">K</span><span><b>kapenta.kitchen</b><small>Lusaka, Zambia</small></span><MoreHorizontal size={16} /></div><div className="phone-photo"><div className="photo-tag">JUST OPENED</div><div className="photo-type">A little<br />taste of<br /><i>home.</i></div><div className="photo-stamp">K</div></div><div className="phone-buttons"><span><Instagram size={16} /></span><span><MessageSquareText size={16} /></span><span><Send size={15} /></span><span className="phone-bookmark">Save</span></div><p><b>kapenta.kitchen</b> Good food, good people. Come through this week.</p><div className="phone-lines" /></div><div className="floating-reach"><span className="reach-icon"><ArrowUpRight size={18} /></span><span><b>One submission</b><small>ready for more reach</small></span></div><span className="art-side-note">BUILT FOR YOUR NEXT CUSTOMER</span></div>
      <div className="hero-bottomline"><span>ONE SIMPLE SUBMISSION</span><span>REVIEWED BY A REAL PERSON</span><span>MADE FOR LOCAL REACH</span></div>
    </section>
    <section className="social-strip"><span className="social-label">YOUR AD, READY FOR</span><span><Instagram size={17} /> Instagram</span><span><MessageSquareText size={17} /> Facebook</span><span><Zap size={16} /> TikTok</span><span className="social-note">We prepare your ad for distribution. Social posting is not automatic.</span></section>
    <section className="steps-section" id="how-it-works"><div className="section-kicker">A BETTER WAY TO BE SEEN</div><div className="section-heading-row"><h2>Three steps.<br /><span>More eyes on you.</span></h2><p>No agency calls. No complicated campaign setup. Just a clear path from your idea to a reviewed ad.</p></div><div className="steps-grid">
      <article className="step-item"><span className="step-index">01</span><div className="step-icon"><FileImage size={20} /></div><h3>Send us your ad</h3><p>Share your message, a photo and where people can find you. One form, done.</p></article>
      <article className="step-item step-highlight"><span className="step-index">02</span><div className="step-icon"><ShieldCheck size={20} /></div><h3>We review it</h3><p>Our team checks every submission and lets you know what happens next.</p></article>
      <article className="step-item"><span className="step-index">03</span><div className="step-icon"><ArrowUpRight size={20} /></div><h3>Get ready for reach</h3><p>Approved ads become ready-to-distribute events. You stay in the loop.</p></article>
    </div><p className="honesty-note"><LockKeyhole size={14} /> Approval prepares your ad for distribution. We do not claim automatic posting to social networks.</p></section>
     <section className="pricing-section" id="pricing"><div className="pricing-intro"><div className="section-kicker">STRAIGHT-UP PRICING</div><h2>Start free.<br /><span>Keep growing.</span></h2><p>Try AdReach with five free submissions. When you’re ready, choose a simple plan that fits your business.</p><div className="pricing-footnote"><Check size={15} /> No hidden fees. No long contracts.</div></div><div className="pricing-cards"><article className="price-card"><div className="price-label">A GOOD PLACE TO START</div><h3>Free</h3><div className="price-amount"><strong>K0</strong><span> / first 5 ads</span></div><p>Get your business in front of more people, one submission at a time.</p><ul><li><Check size={15} /> 5 ad submissions</li><li><Check size={15} /> Human review</li><li><Check size={15} /> Status tracking</li></ul><ButtonLink href="/sign-up" kind="outline">Start with 5 free ads <ArrowRight size={16} /></ButtonLink></article><article className="price-card price-featured"><span className="popular-label">MOST FLEXIBLE</span><div className="price-label">FOR THE WEEKLY PUSH</div><h3>Tier 1 · Weekly</h3><div className="price-amount"><strong>K20</strong><span> / week</span></div><p>Keep sharing your offers and announcements with a little more room.</p><ul><li><Check size={15} /> More ad submissions</li><li><Check size={15} /> Human review</li><li><Check size={15} /> Status tracking</li></ul><ButtonLink href="/sign-up">Choose weekly <ArrowRight size={16} /></ButtonLink></article><article className="price-card"><div className="price-label">FOR A STEADY PRESENCE</div><h3>Tier 2 · Monthly</h3><div className="price-amount"><strong>K100</strong><span> / month</span></div><p>Plan ahead and keep your business visible throughout the month.</p><ul><li><Check size={15} /> More ad submissions</li><li><Check size={15} /> Human review</li><li><Check size={15} /> Status tracking</li></ul><ButtonLink href="/sign-up" kind="outline">Choose monthly <ArrowRight size={16} /></ButtonLink></article></div><p className="price-disclaimer">All prices shown in Zambian Kwacha (ZMK). Pay easily via Mobile Money (Airtel, MTN, Zamtel) with instant WhatsApp verification.</p></section>
    <section className="trust-band"><div className="trust-seal"><BadgeCheck size={23} /></div><div><span className="section-kicker">CLEAR FROM THE START</span><h2>Know where your ad stands.</h2></div><p>Submitted, under review, approved or needs a change. Your dashboard makes the next step easy to understand.</p><ButtonLink href="/sign-up" kind="outline">Create your account <ArrowRight size={16} /></ButtonLink></section>
    <section className="faq-section" id="faq"><div className="faq-title"><div className="section-kicker">GOOD QUESTIONS</div><h2>Before you<br /><span>get started.</span></h2><a href="mailto:hello@adreach.co.zm">Still wondering? Talk to us <ArrowUpRight size={14} /></a></div><div className="faq-list"><details><summary>What happens after I submit an ad?<ChevronDown size={17} /></summary><p>Your ad appears in your dashboard as pending while our team reviews it. You’ll see when it is approved or if it needs a change.</p></details><details><summary>Does AdReach automatically post to social media?<ChevronDown size={17} /></summary><p>No. Approval creates an event that is ready for distribution. We do not claim that an ad is automatically posted to social networks.</p></details><details><summary>What happens after my five free ads?<ChevronDown size={17} /></summary><p>You can continue with a K20 weekly or K100 monthly subscription. Payment is easily made via Mobile Money (Airtel, MTN, Zamtel) and confirmed quickly over WhatsApp.</p></details><details><summary>What kind of ad can I submit?<ChevronDown size={17} /></summary><p>Share a clear message about your Zambian business, a destination link, and an optional image. Keep it accurate, useful and appropriate for a broad audience.</p></details></div></section>
    <section className="closing-cta"><div className="closing-mark"><Megaphone size={24} /></div><div><span>YOUR NEXT CUSTOMER IS OUT THERE</span><h2>Let’s help them find you.</h2></div><ButtonLink href="/sign-up">Submit your first ad <ArrowRight size={17} /></ButtonLink></section>
  </main><footer className="site-footer"><Brand inverse /><span>Made for businesses moving Zambia forward.</span><span>© {new Date().getFullYear()} AdReach</span><a href="mailto:hello@adreach.co.zm">Contact <ArrowUpRight size={14} /></a></footer></div>;
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
              <p>Send K{payment.subscription.amountK} via Airtel Money, MTN MoMo, or Zamtel to <strong>{payment.whatsappNumber}</strong>. Reference: <code>{payment.subscription.id}</code>.</p>
            </div>
          </div>
          <div className="guide-step">
            <span className="guide-step-index">2</span>
            <div>
              <b>Send screenshot on WhatsApp</b>
              <p>Share proof of transfer with our team. Once confirmed, your subscription activates right away.</p>
            </div>
          </div>
        </div>

        <div className="payment-modal-actions">
          <a
            href={payment.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-primary whatsapp-action-btn"
            data-testid="link-whatsapp-payment"
          >
            <MessageSquareText size={17} /> Send screenshot on WhatsApp
          </a>
          <button type="button" className="button button-outline" onClick={onClose}>
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const account = useGetAccount();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const name = user?.fullName || user?.firstName || 'Your account';
  const avatar = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <div className="app-shell page-enter"><aside className={`app-sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><Brand inverse /><button aria-label="Close navigation" className="sidebar-close" onClick={() => setMobileNav(false)}><X size={18} /></button></div><div className="sidebar-label">YOUR WORKSPACE</div><nav className="sidebar-nav"><Link href="/dashboard" className={location === '/dashboard' ? 'nav-current' : ''} onClick={() => setMobileNav(false)}><span className="nav-icon"><MoreHorizontal size={17} /></span>Overview</Link><Link href="/submit" className={location === '/submit' ? 'nav-current' : ''} onClick={() => setMobileNav(false)}><span className="nav-icon"><Plus size={17} /></span>Submit an ad</Link>{account.data?.user.role === 'admin' && <Link href="/admin" className={location === '/admin' ? 'nav-current' : ''} onClick={() => setMobileNav(false)}><span className="nav-icon"><ShieldCheck size={17} /></span>Review workspace</Link>}</nav><div className="sidebar-help"><span className="help-icon"><CircleHelp size={17} /></span><b>Need a hand?</b><p>We’re here if you need help with a submission.</p><a href="mailto:hello@adreach.co.zm">Contact support <ArrowUpRight size={13} /></a></div><div className="sidebar-user"><div className="user-avatar">{avatar}</div><div className="user-meta"><b>{name}</b><small>{user?.primaryEmailAddress?.emailAddress}</small></div><button className="logout-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" title="Sign out" data-testid="button-sign-out"><ArrowUpRight size={15} /></button></div></aside><div className="app-main"><header className="app-topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation" data-testid="button-open-nav"><Menu size={19} /></button><div className="breadcrumb">AdReach <span>/</span> {location === '/submit' ? 'Submit an ad' : location === '/admin' ? 'Review workspace' : 'Overview'}</div><div className="topbar-right"><span className="review-note"><span /> Human review, always</span><div className="top-avatar">{avatar}</div></div></header><div className="app-content">{children}</div></div>{mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}</div>;
}
function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function AccountDashboardPage() {
  const account = useGetAccount();
  const cancel = useCancelSubscription();
  const requestPayment = useRequestManualPayment();
  const queryClient = useQueryClient();
  const plansQuery = useListPlans();
  const [notice, setNotice] = useState('');
  const [paymentModal, setPaymentModal] = useState<ManualPaymentRequest | null>(null);
  const data = account.data;

  const onCheckout = (planId: 'weekly' | 'monthly') => {
    setNotice('');
    requestPayment.mutate({ data: { planId } }, {
      onSuccess: (res) => {
        setPaymentModal(res);
        setNotice('Payment request created. Please send your payment screenshot on WhatsApp.');
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      },
      onError: (err: any) => setNotice(err?.message || 'Could not start payment request.')
    });
  };

  const onCancel = () => {
    if (!window.confirm('Cancel your current subscription?')) return;
    cancel.mutate(undefined, {
      onSuccess: () => {
        setNotice('Your subscription has been canceled.');
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      },
      onError: (err: any) => setNotice(err?.message || 'Could not cancel your subscription.')
    });
  };

  if (account.isLoading) return <AppShell><LoadingState /></AppShell>;
  if (account.isError || !data) return <AppShell><ErrorState message="Your account details are unavailable." retry={() => account.refetch()} /></AppShell>;

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
        <p>Here’s what’s happening with your business today.</p>
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
          <h2>Ads and their progress</h2>
        </div>
        <span className="result-count">{data.ads.length} {data.ads.length === 1 ? 'ad' : 'ads'}</span>
      </div>
      {data.ads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-art"><Megaphone size={25} /></div>
          <h3>Your first ad starts here.</h3>
          <p>Give your business a clear, simple introduction. We’ll take it from there.</p>
          <ButtonLink href="/submit"><Plus size={16} /> Submit your first ad</ButtonLink>
        </div>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead><tr><th>AD</th><th>SUBMITTED</th><th>STATUS</th><th>PLAN</th><th></th></tr></thead>
            <tbody>{data.ads.map((ad) => <AdRow key={ad.id} ad={ad} />)}</tbody>
          </table>
          <div className="mobile-ad-list">{data.ads.map((ad) => <AdMobile key={ad.id} ad={ad} />)}</div>
        </div>
      )}
    </section>

    <section className="dashboard-footnote">
      <span><ShieldCheck size={15} /></span>
      <p><b>What does “Approved” mean?</b> Your ad has passed our review and is ready for distribution. Social posting is not automatic.</p>
    </section>

    {paymentModal && <PaymentModal payment={paymentModal} onClose={() => setPaymentModal(null)} />}
  </AppShell>;
}

function AdRow({ ad }: { ad: Ad }) {
  return <tr data-testid={`row-ad-${ad.id}`}><td><div className="table-ad-title">{ad.imagePath ? <img src={`/api/storage${ad.imagePath}`} alt="" /> : <div className="table-thumb"><FileImage size={16} /></div>}<span><b>{ad.title}</b><small>{ad.description.slice(0, 50)}{ad.description.length > 50 ? '…' : ''}</small></span></div></td><td>{dateLabel(ad.createdAt)}</td><td><StatusPill status={ad.status} />{ad.adminNote && <small className="note-inline">{ad.adminNote}</small>}</td><td><span className="plan-tag">{ad.planId}</span></td><td><a href={ad.link} target="_blank" rel="noreferrer" className="external-link" aria-label={`Open ${ad.title} link`}><ExternalLink size={15} /></a></td></tr>;
}
function AdMobile({ ad }: { ad: Ad }) { return <article className="mobile-ad-card"><div className="mobile-ad-main"><b>{ad.title}</b><StatusPill status={ad.status} /></div><p>{dateLabel(ad.createdAt)} · {ad.planId} plan</p>{ad.adminNote && <small>{ad.adminNote}</small>}<a href={ad.link} target="_blank" rel="noreferrer">Open destination <ExternalLink size={13} /></a></article>; }

function SubmissionPage() {
  const account = useGetAccount();
  const createAd = useCreateAd();
  const requestUpload = useRequestUploadUrl();
  const requestPayment = useRequestManualPayment();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [title, setTitle] = useState('');
  const [adUserName, setAdUserName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [paymentModal, setPaymentModal] = useState<ManualPaymentRequest | null>(null);
  const data = account.data;
  const plansQuery = useListPlans();
  const plans = plansQuery.data || data?.plans || [];
  const canSubmit = data?.canSubmit !== false;
  const formBusy = createAd.isPending || uploading || requestUpload.isPending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data || !canSubmit || formBusy) return;
    setError(''); setSuccess('');
    try {
      let imagePath: string | null = null;
      if (file) {
        setUploading(true);
        const upload = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
        const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!response.ok) throw new Error('Your image could not be uploaded. Please try again.');
        imagePath = upload.objectPath;
        setUploading(false);
      }
      await createAd.mutateAsync({ data: { userName: adUserName.trim() || data.user.name, title: title.trim(), description: description.trim(), link: link.trim(), imagePath } });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      setTitle(''); setDescription(''); setLink(''); setFile(null); setPreview('');
      setSuccess('Your ad is in. We’ll review it and update your dashboard.');
    } catch (err: any) { setUploading(false); setError(err?.message || 'We couldn’t submit your ad. Please try again.'); }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/')) { setError('Choose an image file to continue.'); return; }
    if (selected.size > 8 * 1024 * 1024) { setError('Your image must be smaller than 8 MB.'); return; }
    setError('');
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected); setPreview(URL.createObjectURL(selected));
  };

  if (account.isLoading) return <AppShell><LoadingState label="Preparing your submission form" /></AppShell>;
  if (account.isError || !data) return <AppShell><ErrorState message="We need your account details before you can submit an ad." retry={() => account.refetch()} /></AppShell>;

  const startPlan = (planId: 'weekly' | 'monthly') => {
    requestPayment.mutate({ data: { planId } }, {
      onSuccess: (res) => {
        setPaymentModal(res);
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      },
      onError: (err: any) => setError(err?.message || 'Could not start payment request.')
    });
  };

  return <AppShell>
    <div className="page-heading submit-heading">
      <div>
        <div className="section-kicker">ONE FORM, ONE CLEAR NEXT STEP</div>
        <h1>Submit an ad</h1>
        <p>Tell people what makes your business worth finding.</p>
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
          <h2>You’ve used your five free ads.</h2>
          <p>Choose a plan to keep submitting and tracking your ads via manual Mobile Money / Bank transfer.</p>
          <div className="limit-plans">
            {plans.map((plan) => (
              <button key={plan.id} onClick={() => startPlan(plan.id)} disabled={requestPayment.isPending} data-testid={`button-subscribe-${plan.id}`}>
                <b>{plan.name}</b>
                <span>K{plan.amountK} / {plan.interval}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <small>Payment verification handled via WhatsApp (+260 760 312 951).</small>
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
          <div className="input-with-icon"><Link2 size={16} /><input id="ad-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} required placeholder="https://yourwebsite.com or a social profile" data-testid="input-ad-link" /></div>

          <label className="field-label">Add an image <span>Optional</span></label>
          <label className={`upload-box ${preview ? 'has-preview' : ''}`} htmlFor="ad-image">
            {preview ? <><img src={preview} alt="Selected ad image preview" /><span className="upload-change"><ImagePlus size={16} /> Change image</span></> : <><span className="upload-icon"><ImagePlus size={18} /></span><b>Choose an image</b><span>JPG, PNG or WEBP · max 8 MB</span></>}
            <input id="ad-image" type="file" accept="image/*" onChange={onFileChange} data-testid="input-ad-image" />
          </label>
          {file && <button type="button" className="remove-file" onClick={() => { setFile(null); setPreview(''); }}>Remove image <X size={13} /></button>}

          <div className="form-disclosure"><ShieldCheck size={17} /><span>Every ad is reviewed by our team before it can be approved. Approval prepares it for distribution; social posting is not automatic.</span></div>
          <button className="button button-primary submit-button" type="submit" disabled={formBusy || !data.canSubmit} data-testid="button-submit-ad">
            {formBusy ? <><LoaderCircle className="spin" size={16} /> {uploading ? 'Uploading image…' : 'Submitting…'}</> : <>Send for review <ArrowRight size={16} /></>}
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
          <div className="submission-tip"><span className="tip-icon"><Sparkles size={16} /></span><div><b>A useful tip</b><p>A clear offer and a working link help people take the next step.</p></div></div>
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
  </AppShell>;
}

function AdminPage() {
  const queryClient = useQueryClient();
  const overview = useGetAdminOverview();
  const ads = useListAdminAds({ status: 'pending' });
  const pendingPayments = useListPendingPayments();
  const logs = useListWebhookLogs();
  const review = useReviewAd();
  const reviewPayment = useReviewPayment();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all' | 'payments'>('pending');
  const allAds = useListAdminAds(filter === 'all' ? { status: 'all' } : { status: 'pending' });
  const visibleAds = allAds.data || ads.data;

  const reload = () => {
    overview.refetch();
    ads.refetch();
    pendingPayments.refetch();
    logs.refetch();
    allAds.refetch();
  };

  const doReview = (ad: AdminAd, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !notes[ad.id]?.trim() && !window.confirm('Reject this ad without a note for the business?')) return;
    review.mutate({ id: ad.id, data: { decision, note: notes[ad.id]?.trim() || undefined } }, {
      onSuccess: () => {
        setFeedback(decision === 'approve' ? 'Ad approved and marked ready for distribution.' : 'Ad returned to the business with your review.');
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAdminAdsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWebhookLogsQueryKey() });
      },
      onError: (err: any) => setFeedback(err?.message || 'Could not update this ad.'),
    });
  };

  const doReviewPayment = (payment: AdminPaymentRequest, decision: 'approve' | 'reject') => {
    const note = paymentNotes[payment.id]?.trim() || undefined;
    reviewPayment.mutate({ id: payment.id, data: { decision, note } }, {
      onSuccess: () => {
        setFeedback(decision === 'approve' ? `Payment for ${payment.userName} confirmed. Subscription activated!` : 'Payment request rejected.');
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPendingPaymentsQueryKey() });
      },
      onError: (err: any) => setFeedback(err?.message || 'Could not review payment.'),
    });
  };

  if (overview.isLoading || ads.isLoading) return <AppShell><LoadingState label="Loading the review queue" /></AppShell>;
  if (overview.isError || ads.isError) return <AppShell><ErrorState message="The review workspace is unavailable. Access is checked by the server." retry={reload} /></AppShell>;

  const stats = overview.data!;

  return <AppShell>
    <div className="page-heading">
      <div>
        <div className="section-kicker">ADREACH OPERATIONS</div>
        <h1>Review workspace</h1>
        <p>Keep every decision clear, consistent and ready for the next step.</p>
      </div>
      <span className="admin-access-label"><ShieldCheck size={15} /> Server-authorized workspace</span>
    </div>

    {feedback && <div className="notice-banner"><Check size={16} />{feedback}<button onClick={() => setFeedback('')} aria-label="Dismiss message"><X size={14} /></button></div>}

    <div className="admin-stats">
      <div><span>PENDING ADS</span><b>{stats.pendingAds}</b><i><Clock3 size={14} /> Needs review</i></div>
      <div><span>APPROVED ADS</span><b>{stats.activeAds}</b><i><BadgeCheck size={14} /> Ready for distribution</i></div>
      <div><span>PENDING PAYMENTS</span><b>{stats.pendingPayments ?? 0}</b><i><Zap size={14} /> Awaiting screenshot check</i></div>
      <div><span>QUEUED EVENTS</span><b>{stats.queuedEvents}</b><i><Send size={14} /> Webhook-ready</i></div>
    </div>

    <section className="admin-queue panel">
      <div className="section-title-row">
        <div>
          <div className="section-kicker">QUEUE MANAGEMENT</div>
          <h2>{filter === 'payments' ? 'Subscription Payment Requests' : 'Ad Review Queue'}</h2>
        </div>
        <div className="filter-tabs">
          <button onClick={() => setFilter('pending')} className={filter === 'pending' ? 'active-filter' : ''}>Pending Ads ({stats.pendingAds})</button>
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active-filter' : ''}>All Ads</button>
          <button onClick={() => setFilter('payments')} className={filter === 'payments' ? 'active-filter' : ''}>
            Pending Payments ({stats.pendingPayments ?? 0})
          </button>
        </div>
      </div>

      {filter === 'payments' ? (
        pendingPayments.isLoading ? (
          <LoadingState label="Loading pending payment requests" />
        ) : pendingPayments.isError ? (
          <ErrorState message="Could not load payment requests." retry={() => pendingPayments.refetch()} />
        ) : !pendingPayments.data?.length ? (
          <div className="empty-state compact-empty">
            <div className="empty-art"><Check size={24} /></div>
            <h3>No pending payments.</h3>
            <p>All subscription payments have been confirmed or reviewed.</p>
          </div>
        ) : (
          <div className="admin-payment-list">
            {pendingPayments.data.map((req) => (
              <article className="review-card payment-review-card" key={req.id} data-testid={`payment-request-${req.id}`}>
                <div className="review-card-top">
                  <div>
                    <span className="review-tier">{req.planId} plan · K{req.amountK}</span>
                    <h3>{req.userName}</h3>
                    <p>{req.email}</p>
                  </div>
                  <div className="payment-ref-pill">
                    <small>REF:</small> <code>{req.id}</code>
                  </div>
                </div>
                <div className="review-meta">
                  <span>Requested: {dateLabel(req.startedAt)}</span>
                  <a
                    href={`https://wa.me/260760312951?text=${encodeURIComponent(`Hi ${req.userName}, regarding your AdReach payment reference ${req.id}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                  >
                    <MessageSquareText size={13} /> Open WhatsApp chat
                  </a>
                </div>
                <textarea
                  className="review-note-input"
                  value={paymentNotes[req.id] || ''}
                  onChange={(e) => setPaymentNotes({ ...paymentNotes, [req.id]: e.target.value })}
                  placeholder="Optional review note (e.g. Transaction verified / screenshot missing)"
                  data-testid={`input-payment-note-${req.id}`}
                />
                <div className="review-actions">
                  <button
                    className="button button-reject"
                    disabled={reviewPayment.isPending}
                    onClick={() => doReviewPayment(req, 'reject')}
                    data-testid={`button-reject-payment-${req.id}`}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                  <button
                    className="button button-primary"
                    disabled={reviewPayment.isPending}
                    onClick={() => doReviewPayment(req, 'approve')}
                    data-testid={`button-approve-payment-${req.id}`}
                  >
                    {reviewPayment.isPending ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Confirm & Activate
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : allAds.isLoading ? (
        <LoadingState label="Refreshing ads" />
      ) : allAds.isError ? (
        <ErrorState message="Could not load the ad list." retry={() => allAds.refetch()} />
      ) : !visibleAds?.length ? (
        <div className="empty-state compact-empty">
          <div className="empty-art"><Check size={24} /></div>
          <h3>{filter === 'pending' ? 'Queue is clear.' : 'No ads to show yet.'}</h3>
          <p>{filter === 'pending' ? 'There are no ads waiting for review.' : 'Submissions will appear here.'}</p>
        </div>
      ) : (
        <div className="admin-ad-list">
          {visibleAds.map((ad) => (
            <article className="review-card" key={ad.id} data-testid={`review-ad-${ad.id}`}>
              <div className="review-card-top">
                <div className="review-ad-identity">
                  {ad.imagePath ? <img src={`/api/storage${ad.imagePath}`} alt="" /> : <span className="review-thumb"><FileImage size={17} /></span>}
                  <div>
                    <span className="review-tier">{ad.userTier} plan</span>
                    <h3>{ad.title}</h3>
                    <p>{ad.userName} · {ad.email}</p>
                  </div>
                </div>
                <StatusPill status={ad.status} />
              </div>
              <p className="review-description">{ad.description}</p>
              <a className="review-destination" href={ad.link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {ad.link}</a>
              <div className="review-meta">
                <span>Submitted {dateLabel(ad.createdAt)}</span>
                {ad.imagePath && <a href={`/api/storage${ad.imagePath}`} target="_blank" rel="noreferrer">View image <ArrowUpRight size={12} /></a>}
              </div>
              {ad.status === 'pending' && (
                <>
                  <textarea
                    className="review-note-input"
                    value={notes[ad.id] || ''}
                    onChange={(e) => setNotes({ ...notes, [ad.id]: e.target.value })}
                    placeholder="Optional note for the business. Required if changes are needed."
                    data-testid={`input-review-note-${ad.id}`}
                  />
                  <div className="review-actions">
                    <button className="button button-reject" disabled={review.isPending} onClick={() => doReview(ad, 'reject')} data-testid={`button-reject-${ad.id}`}>
                      <XCircle size={15} /> Request changes
                    </button>
                    <button className="button button-primary" disabled={review.isPending} onClick={() => doReview(ad, 'approve')} data-testid={`button-approve-${ad.id}`}>
                      {review.isPending ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Approve ad
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>

    <section className="events-section panel">
      <div className="section-title-row">
        <div>
          <div className="section-kicker">WEBHOOK-READY ACTIVITY</div>
          <h2>Distribution event log</h2>
        </div>
        <button className="icon-button" onClick={() => logs.refetch()} aria-label="Refresh event log" data-testid="button-refresh-events"><RefreshCw size={15} /></button>
      </div>
      <p className="event-disclaimer">These are application events, not proof of social network publishing.</p>
      {logs.isLoading ? <LoadingState label="Loading event log" /> : logs.isError ? <ErrorState message="Could not load distribution events." retry={() => logs.refetch()} /> : !(logs.data?.length) ? <div className="empty-log">No events yet. New submissions and approvals will appear here.</div> : <div className="event-list">{logs.data.slice(0, 8).map((event) => <EventRow key={event.id} event={event} />)}</div>}
    </section>
  </AppShell>;
}

function EventRow({ event }: { event: DistributionEvent }) {
  return <div className="event-row" data-testid={`event-${event.id}`}><span className={`event-type-icon ${event.eventType === 'ad.approved' ? 'event-approved' : ''}`}>{event.eventType === 'ad.approved' ? <Check size={15} /> : <Send size={14} />}</span><div className="event-description"><b>{event.eventType === 'ad.approved' ? 'Ad approved' : 'Ad submitted'}</b><small>Ad ref. {event.adId}</small></div><span className={`event-state event-${event.status}`}>{event.status}</span><time>{dateLabel(event.createdAt)}</time></div>;
}

function SignInPage() { return <div className="auth-page"><div className="auth-backdrop"><div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><div className="auth-back-copy"><Brand inverse /><p>Good work deserves<br />to be seen.</p><span>ADVERTISING MADE EASIER, RIGHT HERE.</span></div></div><div className="auth-form-side"><Link href="/" className="auth-mobile-brand"><Brand /></Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /><p className="auth-privacy"><LockKeyhole size={13} /> Your account is protected by Clerk.</p></div></div>; }
function SignUpPage() { return <div className="auth-page"><div className="auth-backdrop"><div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><div className="auth-back-copy"><Brand inverse /><p>Your next<br />customer is<br /><em>out there.</em></p><span>START WITH FIVE FREE AD SUBMISSIONS.</span></div></div><div className="auth-form-side"><Link href="/" className="auth-mobile-brand"><Brand /></Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /><p className="auth-privacy"><LockKeyhole size={13} /> Your account is protected by Clerk.</p></div></div>; }

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
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

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to manage your AdReach submissions.' } }, signUp: { start: { title: 'Create your AdReach account', subtitle: 'Start with five free ad submissions.' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <ClerkQueryClientCacheInvalidator />
    <Switch><Route path="/" component={HomeRoute} /><Route path="/dashboard"><Protected><AccountDashboardPage /></Protected></Route><Route path="/submit"><Protected><SubmissionPage /></Protected></Route><Route path="/admin"><Protected><AdminPage /></Protected></Route><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route component={() => <div className="not-found"><Brand /><h1>That page isn’t here.</h1><p>Let’s get you back on track.</p><ButtonLink href="/">Back to AdReach <ArrowRight size={16} /></ButtonLink></div>} /></Switch>
  </ClerkProvider>;
}
function HomeRoute() { return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>; }
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><RoutedErrorBoundary><ClerkRoutes /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
