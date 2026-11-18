import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import {
  Mail,
  Phone,
  Lock,
  User,
  ArrowRight,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithApple,
  signInWithEmail,
  signUpWithEmail,
  setupRecaptcha,
  sendPhoneOtp,
  confirmPhoneOtp,
} from '@/lib/firebase';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

interface FirebaseAuthCardProps {
  mode: 'sign-in' | 'sign-up';
  onSuccess?: () => void;
}

export function FirebaseAuthCard({ mode: initialMode, onSuccess }: FirebaseAuthCardProps) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');

  // Email form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone form state
  const [phonePrefix, setPhonePrefix] = useState('+260');
  const [rawPhone, setRawPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSuccess('');
  }, [initialMode]);

  const handleAuthSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      setLocation('/dashboard');
    }
  };

  // Google sign in
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      handleAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not complete Google sign-in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Apple sign in
  const handleApple = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithApple();
      handleAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not complete Apple sign-in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Email sign in / sign up
  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'sign-up') {
        if (!email || !password) throw new Error('Please enter your email and a password.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await signUpWithEmail(email.trim(), password, displayName.trim() || undefined);
      } else {
        if (!email || !password) throw new Error('Please enter both your email and password.');
        await signInWithEmail(email.trim(), password);
      }
      handleAuthSuccess();
    } catch (err: any) {
      console.error(err);
      const code = err?.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please check your credentials.');
      } else if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please click "Sign in" below.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err?.message || 'Authentication error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Send Phone SMS OTP
  const handleSendPhoneOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let cleanedPhone = rawPhone.replace(/\D/g, '');
      if (cleanedPhone.startsWith('0')) {
        cleanedPhone = cleanedPhone.slice(1);
      }
      if (!cleanedPhone || cleanedPhone.length < 8) {
        throw new Error('Please enter a valid Zambian mobile number (e.g. 97 123 4567).');
      }

      const fullNumber = `${phonePrefix}${cleanedPhone}`;

      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      }

      if (!recaptchaVerifierRef.current) {
        throw new Error('Verification service initialising. Please try again.');
      }

      const confirmation = await sendPhoneOtp(fullNumber, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setSuccess(`SMS code sent to ${fullNumber}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Could not send verification code. Check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  // Verify Phone SMS OTP
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || !otpCode) return;
    setError('');
    setLoading(true);

    try {
      await confirmPhoneOtp(confirmationResult, otpCode.trim());
      handleAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Incorrect verification code. Please check your SMS and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card-container" style={{
      maxWidth: '430px',
      width: '100%',
      background: '#fffefa',
      borderRadius: '20px',
      border: '1px solid #deded3',
      padding: '30px 26px',
      boxShadow: '0 20px 50px rgba(27,68,58,.08)',
    }}>
      <div id="recaptcha-container"></div>

      <div style={{ textAlign: 'center', marginBottom: '22px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1d3934', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p style={{ color: '#697d77', fontSize: '13px', margin: 0 }}>
          {mode === 'sign-up'
            ? 'Start with 10 free ads broadcasted across verified Zambian groups.'
            : 'Sign in to manage your submissions and social broadcasts.'}
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          color: '#166534',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      {/* Social Single-Click Logins */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            height: '44px',
            background: '#ffffff',
            border: '1px solid #deded3',
            borderRadius: '10px',
            color: '#1d3934',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#f7f6ee')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#ffffff')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.66-5.2 3.66-9.12z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.28v3.13C3.25 21.3 7.31 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.28C.46 8.2 0 10.04 0 12s.46 3.8 1.28 5.42l4-3.13z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.58l4 3.13c.95-2.82 3.6-4.96 6.72-4.96z"/>
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={handleApple}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            height: '44px',
            background: '#1d3934',
            border: 'none',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 170 170" fill="currentColor">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.03-7.6-7.79-11.74-14.28-5.59-8.7-10.14-18.73-13.65-30.08-3.5-11.35-5.26-22.18-5.26-32.48 0-14.82 3.8-26.68 11.41-35.58 7.6-8.91 17.06-13.43 28.38-13.57 5.18 0 10.74 1.34 16.68 4.01 5.94 2.67 9.87 4.07 11.79 4.19 1.48-.12 5.56-1.57 12.24-4.35 6.68-2.78 12.35-3.96 17.02-3.54 13.06 1.08 23.36 5.86 30.9 14.35-11.33 6.84-16.87 16.32-16.63 28.44.25 9.45 3.89 17.44 10.92 23.97 7.03 6.54 15.34 10.17 24.94 10.91-2.09 6.27-4.63 12.83-7.64 19.67zM119.22 33.08c0-7.23 2.63-14.07 7.9-20.52 5.27-6.45 11.83-10.63 19.68-12.56.25 1.25.37 2.44.37 3.56 0 7.12-2.73 14.03-8.19 20.73-5.46 6.7-11.96 10.65-19.5 11.85-.08-1.01-.26-2.03-.26-3.06z"/>
          </svg>
          Continue with Apple
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
        <div style={{ flex: 1, height: '1px', background: '#deded3' }} />
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#88978e', fontWeight: 600, letterSpacing: '0.05em' }}>
          Or continue with
        </span>
        <div style={{ flex: 1, height: '1px', background: '#deded3' }} />
      </div>

      {/* Auth Method Switcher Tabs (Email vs Phone) */}
      <div style={{
        display: 'flex',
        background: '#f1f0e6',
        borderRadius: '10px',
        padding: '3px',
        marginBottom: '18px',
      }}>
        <button
          type="button"
          onClick={() => { setAuthMethod('email'); setError(''); }}
          style={{
            flex: 1,
            padding: '7px 0',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: authMethod === 'email' ? 700 : 500,
            background: authMethod === 'email' ? '#ffffff' : 'transparent',
            color: authMethod === 'email' ? '#1d3934' : '#697d77',
            cursor: 'pointer',
            boxShadow: authMethod === 'email' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Mail size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-1px' }} />
          Email Address
        </button>
        <button
          type="button"
          onClick={() => { setAuthMethod('phone'); setError(''); }}
          style={{
            flex: 1,
            padding: '7px 0',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: authMethod === 'phone' ? 700 : 500,
            background: authMethod === 'phone' ? '#ffffff' : 'transparent',
            color: authMethod === 'phone' ? '#1d3934' : '#697d77',
            cursor: 'pointer',
            boxShadow: authMethod === 'phone' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Phone size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-1px' }} />
          Zambian Phone
        </button>
      </div>

      {/* METHOD 1: EMAIL & PASSWORD */}
      {authMethod === 'email' && (
        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'sign-up' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d3934', marginBottom: '6px' }}>
                Your Name or Business Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#88978e' }} />
                <input
                  type="text"
                  placeholder="e.g. Kapenta Grill & Catering"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 12px 0 38px',
                    borderRadius: '8px',
                    border: '1px solid #d9dbce',
                    background: '#ffffff',
                    fontSize: '16px',
                    color: '#1d3934',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d3934', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#88978e' }} />
              <input
                type="email"
                required
                placeholder="name@business.zm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 12px 0 38px',
                  borderRadius: '8px',
                  border: '1px solid #d9dbce',
                  background: '#ffffff',
                  fontSize: '16px',
                  color: '#1d3934',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d3934', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#88978e' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 12px 0 38px',
                  borderRadius: '8px',
                  border: '1px solid #d9dbce',
                  background: '#ffffff',
                  fontSize: '16px',
                  color: '#1d3934',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              height: '48px',
              background: '#236b58',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            {loading ? <LoaderCircle className="spin" size={17} /> : null}
            {mode === 'sign-up' ? 'Create Free Account' : 'Sign In to AdReach'}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>
      )}

      {/* METHOD 2: ZAMBIAN PHONE NUMBER (SMS OTP) */}
      {authMethod === 'phone' && (
        <div>
          {!otpSent ? (
            <form onSubmit={handleSendPhoneOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1d3934', marginBottom: '6px' }}>
                  Zambian Mobile Number
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{
                    width: '84px',
                    height: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f1f0e6',
                    border: '1px solid #d9dbce',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#1d3934',
                  }}>
                    🇿🇲 +260
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="97 123 4567"
                    value={rawPhone}
                    onChange={(e) => setRawPhone(e.target.value)}
                    style={{
                      flex: 1,
                      height: '46px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #d9dbce',
                      background: '#ffffff',
                      fontSize: '16px',
                      color: '#1d3934',
                      outline: 'none',
                    }}
                  />
                </div>
                <small style={{ color: '#6a7d74', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                  Airtel, MTN, or Zamtel number. We will send an SMS code.
                </small>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  height: '48px',
                  background: '#236b58',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                {loading ? <LoaderCircle className="spin" size={17} /> : <Smartphone size={16} />}
                Send SMS Verification Code
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1d3934', marginBottom: '5px' }}>
                  Enter 6-Digit SMS Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                    fontSize: '18px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid #236b58',
                    background: '#ffffff',
                    color: '#1d3934',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  height: '44px',
                  background: '#236b58',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {loading ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={16} />}
                Confirm & Log In
              </button>

              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtpCode(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#697d77',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                ← Change phone number
              </button>
            </form>
          )}
        </div>
      )}

      {/* Switch between Sign In and Sign Up */}
      <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #deded3' }}>
        {mode === 'sign-up' ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#697d77' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('sign-in'); setError(''); }}
              style={{ background: 'transparent', border: 'none', color: '#236b58', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              Sign in
            </button>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#697d77' }}>
            New to AdReach?{' '}
            <button
              type="button"
              onClick={() => { setMode('sign-up'); setError(''); }}
              style={{ background: 'transparent', border: 'none', color: '#236b58', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              Create free account
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
