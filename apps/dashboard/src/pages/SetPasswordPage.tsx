import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Mode = 'invite' | 'reset';

export function SetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = params.get('token') || '';
  const mode: Mode = location.pathname.includes('reset') ? 'reset' : ((params.get('type') as Mode) || 'invite');

  const [tokenInfo, setTokenInfo] = useState<{ email: string; name: string } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('الرابط غير صالح');
      return;
    }
    apiRequest<{ valid: boolean; email: string; name: string }>(`/auth/verify-token?token=${token}&type=${mode}`)
      .then((res) => setTokenInfo(res))
      .catch(() => setTokenError('الرابط غير صالح أو منتهي الصلاحية'));
  }, [token, mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const endpoint = mode === 'reset' ? '/auth/reset-password' : '/auth/set-password';
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ token, password }) });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'reset' ? 'إعادة تعيين كلمة المرور' : 'تفعيل حسابك';
  const subtitle = mode === 'reset' ? 'أدخل كلمة المرور الجديدة' : 'عيّن كلمة المرور لتفعيل حسابك';

  return (
    <div className="auth-page" dir="rtl">
      <div className="auth-panel">
        <div className="auth-card">
          <h2>{title}</h2>
          <p className="auth-lead">
            {subtitle}
            {tokenInfo ? ` · ${tokenInfo.email}` : ''}
          </p>

          {tokenError ? (
            <div className="auth-alert error">
              <AlertCircle size={18} />
              <span>{tokenError}</span>
            </div>
          ) : success ? (
            <div className="auth-alert success">
              <CheckCircle size={28} />
              <p>تم تعيين كلمة المرور. سيتم نقلك إلى صفحة الدخول.</p>
            </div>
          ) : !tokenInfo ? (
            <div className="auth-lead">
              <Loader2 size={28} className="animate-spin" />
              <p>جار التحقق من الرابط...</p>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="new-password">كلمة المرور الجديدة</label>
                <div className="auth-input-wrap">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPw ? 'text' : 'password'}
                    placeholder="8 أحرف على الأقل"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="auth-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="confirm-password">تأكيد كلمة المرور</label>
                <div className="auth-input-wrap">
                  <Lock size={18} aria-hidden="true" />
                  <input
                    id="confirm-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    type={showPw ? 'text' : 'password'}
                    placeholder="أعد كتابة كلمة المرور"
                    required
                  />
                </div>
              </div>

              {password && confirm && password !== confirm && (
                <div className="auth-alert error">كلمتا المرور غير متطابقتين</div>
              )}

              {error && (
                <div className="auth-alert error" role="alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary auth-submit"
                disabled={isSubmitting || (!!password && !!confirm && password !== confirm)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>جار الحفظ...</span>
                  </>
                ) : (
                  <>
                    <span>حفظ كلمة المرور</span>
                    <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
