import { FormEvent, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mascot } from '../components/Mascot';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import './LoginPage.css';

export function LoginPage() {
  const { login, token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      await login(email.trim(), password);
    } catch (submissionError) {
      const rawMessage =
        submissionError instanceof Error ? submissionError.message : 'تعذر تسجيل الدخول';
      setError(
        /invalid credentials/i.test(rawMessage)
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : rawMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="vayro-login-page" dir="rtl">
      <div className="vayro-login-shell">
        <section className="vayro-login-intro" aria-label="VAYRO">
          <div className="vayro-login-brand">
            <div className="vayro-login-mark">V</div>
            <div>
              <strong>VAYRO</strong>
              <span>Business Messaging Platform</span>
            </div>
          </div>

          <div className="vayro-login-mascot">
            <Mascot pose="idle" size={154} />
          </div>

          <div className="vayro-login-intro-copy">
            <span className="vayro-login-kicker">بوابة مساحة العمل</span>
            <h1>كل أدوات التواصل في مكان واحد</h1>
            <p>
              ادخل إلى مساحة عمل شركتك لإدارة واتساب، رموز التحقق، صندوق الفريق، التوظيف
              وخدمات الخصوصية من لوحة واحدة.
            </p>
          </div>

          <div className="vayro-login-capabilities" aria-label="خدمات VAYRO">
            <span>OTP</span>
            <span>الصندوق المشترك</span>
            <span>التوظيف</span>
            <span>الخصوصية</span>
          </div>
        </section>

        <section className="vayro-login-form-side">
          <div className="vayro-login-mobile-brand">
            <div className="vayro-login-mark">V</div>
            <strong>VAYRO</strong>
          </div>

          <div className="vayro-login-heading">
            <div className="vayro-login-security-icon">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <h2>تسجيل الدخول</h2>
              <p>استخدم بيانات حسابك للوصول إلى مساحة عملك.</p>
            </div>
          </div>

          <form className="vayro-login-form" onSubmit={handleSubmit}>
            <label className="vayro-login-field" htmlFor="login-email">
              <span>البريد الإلكتروني</span>
              <div className="vayro-login-input">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="login-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  dir="ltr"
                  required
                />
              </div>
            </label>

            <label className="vayro-login-field" htmlFor="login-password">
              <div className="vayro-login-field-head">
                <span>كلمة المرور</span>
                <Link to="/forgot-password">نسيت كلمة المرور؟</Link>
              </div>
              <div className="vayro-login-input">
                <Lock size={18} aria-hidden="true" />
                <input
                  id="login-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  dir="ltr"
                  required
                />
                <button
                  className="vayro-login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="vayro-login-alert" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button className="vayro-login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جار تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <span>الدخول إلى مساحة العمل</span>
                  <ArrowLeft size={19} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className="vayro-login-help">
            هذه البوابة مخصصة لحسابات VAYRO المفعّلة. إذا لم تكن لديك بيانات دخول، تواصل
            مع مدير مساحة العمل لديك.
          </p>
        </section>
      </div>

      <footer className="vayro-login-footer">
        <span>VAYRO</span>
        <span>•</span>
        <span>اتصال آمن ومشفّر</span>
      </footer>
    </main>
  );
}
