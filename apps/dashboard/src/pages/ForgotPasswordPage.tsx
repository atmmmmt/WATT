import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { apiRequest } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page" dir="rtl">
      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-mascot" aria-hidden="true">
            <Lock size={28} color="var(--brand-primary)" />
          </div>
          <h2>نسيت كلمة المرور؟</h2>
          <p className="auth-lead">أدخل بريدك وسنرسل رابط الاسترداد إن كان الحساب موجوداً.</p>

          {success ? (
            <div className="auth-alert success">
              <CheckCircle size={28} />
              <p>إذا كان البريد مسجّلاً ستصلك رسالة خلال دقائق.</p>
              <Link to="/login">العودة لتسجيل الدخول</Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="forgot-email">البريد الإلكتروني</label>
                <div className="auth-input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="forgot-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="auth-alert error" role="alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn-primary auth-submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>جار الإرسال...</span>
                  </>
                ) : (
                  <>
                    <span>إرسال رابط الاسترداد</span>
                    <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
                  </>
                )}
              </button>

              <div className="auth-footer">
                <Link to="/login">العودة لتسجيل الدخول</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
