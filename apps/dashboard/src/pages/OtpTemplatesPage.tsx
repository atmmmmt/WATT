import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, Save, ShieldAlert, Type } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

type TemplateKey = 'login' | 'register' | 'forgotPassword';

interface OtpSettingsResponse {
  templates: Record<TemplateKey, string>;
  effectiveTemplates: Record<TemplateKey, string>;
  placeholders: {
    required: string[];
    optional: string[];
  };
  labels: Record<TemplateKey, string>;
}

const TEMPLATE_ORDER: TemplateKey[] = ['login', 'register', 'forgotPassword'];
const REQUIRED_PLACEHOLDER = '{{code}}';

export function OtpTemplatesPage() {
  const { token, user } = useAuth();
  const [payload, setPayload] = useState<OtpSettingsResponse | null>(null);
  const [form, setForm] = useState<Record<TemplateKey, string>>({
    login: '',
    register: '',
    forgotPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    if (!token) return;
    const data = await apiRequest<OtpSettingsResponse>('/otp/settings', {}, token);
    setPayload(data);
    setForm(data.templates);
  }

  useEffect(() => {
    load().catch((error) => console.error(error));
  }, [token]);

  const validation = useMemo(() => {
    const invalidKeys = TEMPLATE_ORDER.filter((key) => {
      const value = form[key].trim();
      return value.length > 0 && !value.includes(REQUIRED_PLACEHOLDER);
    });

    return {
      invalidKeys,
      isValid: invalidKeys.length === 0,
    };
  }, [form]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !validation.isValid) return;

    setSaving(true);
    try {
      const data = await apiRequest<OtpSettingsResponse>(
        '/otp/settings',
        {
          method: 'POST',
          body: JSON.stringify({
            templates: form,
          }),
        },
        token,
      );
      setPayload(data);
      setForm(data.templates);
      setNotice('تم حفظ نصوص رسائل OTP بنجاح.');
      setTimeout(() => setNotice(''), 3500);
    } finally {
      setSaving(false);
    }
  }

  function renderPreview(key: TemplateKey) {
    const source = form[key].trim() || payload?.effectiveTemplates[key] || '';
    return source
      .replaceAll('{{code}}', '482913')
      .replaceAll('{{expiresInMinutes}}', '5');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-stack"
      dir="rtl"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">إدارة نصوص OTP</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>قوالب رسائل التحقق</h1>
        </div>
        <AnimatePresence>
          {notice ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{
                background: 'var(--status-success)',
                color: 'white',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              <CheckCircle2 size={16} /> {notice}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <article className="card" style={{ background: '#fff7ed', border: '1px solid #fdba74' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <ShieldAlert size={20} color="#c2410c" />
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#9a3412' }}>
              شرط أساسي قبل الحفظ
            </div>
            <p style={{ fontSize: '0.85rem', color: '#9a3412', lineHeight: 1.8 }}>
              كل قالب يجب أن يحتوي على <span className="ltr">{REQUIRED_PLACEHOLDER}</span> حتى يعرف
              النظام أين يضع رقم التحقق. إذا تركت الحقل فارغاً فلن يتم حفظ قالب مخصص، وسيعود
              النظام إلى النص الافتراضي.
            </p>
          </div>
        </div>
      </article>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {TEMPLATE_ORDER.map((key) => {
          const invalid = validation.invalidKeys.includes(key);
          return (
            <article key={key} className="card" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                  <Type size={18} color="var(--brand-primary)" />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    {payload?.labels[key] || key}
                  </h3>
                </div>
                <textarea
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                  rows={5}
                  placeholder={payload?.effectiveTemplates[key] || ''}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '150px',
                    borderColor: invalid ? '#dc2626' : undefined,
                  }}
                />
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: invalid ? '#dc2626' : 'var(--text-muted)' }}>
                  {invalid
                    ? `هذا القالب لن يُحفظ لأنه لا يحتوي على ${REQUIRED_PLACEHOLDER}.`
                    : `المتغيرات المتاحة: ${(payload?.placeholders.required || [REQUIRED_PLACEHOLDER])
                        .concat(payload?.placeholders.optional || [])
                        .join(' ، ')}`}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>معاينة الرسالة</div>
                  <div style={{ fontSize: '0.9rem', lineHeight: 1.9 }}>{renderPreview(key)}</div>
                </div>
                <div className="card" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Info size={16} color="var(--brand-primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>ترتيب متغيرات الرسالة</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    <div>1. اكتب نص الرسالة بالشكل الذي تريده.</div>
                    <div>
                      2. ضع <span className="ltr">{REQUIRED_PLACEHOLDER}</span> في المكان الذي تريد ظهور
                      الكود فيه.
                    </div>
                    <div>
                      3. يمكنك إضافة <span className="ltr">{'{{expiresInMinutes}}'}</span> إذا أردت ذكر مدة
                      صلاحية الكود.
                    </div>
                    <div>4. إذا حذفت الحقل بالكامل سيعود النظام تلقائياً للنص الافتراضي.</div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        <button
          type="submit"
          className="btn-primary"
          style={{ justifySelf: 'flex-start' }}
          disabled={saving || !validation.isValid}
        >
          <Save size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ نصوص الرسائل'}
        </button>
      </form>
    </motion.div>
  );
}
