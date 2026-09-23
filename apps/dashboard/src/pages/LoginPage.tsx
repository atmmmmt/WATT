import { FormEvent, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mascot } from '../components/Mascot';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const { login, token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'تعذر تسجيل الدخول',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page" dir="rtl">
      <aside className="auth-aside">
        <div className="auth-aside-brand">
          <strong>VAYRO</strong>
        </div>
        <h1>منصة واتساب واحدة للتحقق والدعم والتوظيف</h1>
        <p>
          أدر رموز OTP، صندوق الفريق، ومتابعة المرشحين من لوحة عربية واضحة — بدون بناء نظام من الصفر.
        </p>
      </aside>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-mascot">
            <Mascot pose="idle" size={128} />
          </div>
          <h2>تسجيل الدخول</h2>
          <p className="auth-lead">أهلاً بك مجدداً في VAYRO</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-email">البريد الإلكتروني</label>
              <div className="auth-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field-head">
                <label htmlFor="login-password">كلمة المرور</label>
                <Link to="/forgot-password">نسيت كلمة المرور؟</Link>
              </div>
              <div className="auth-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="auth-alert error" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary auth-submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جار الدخول...</span>
                </>
              ) : (
                <>
                  <span>دخول للنظام</span>
                  <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
