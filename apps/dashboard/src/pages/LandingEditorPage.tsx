import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  FileText,
  MessageCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type LandingPlan = {
  id: string;
  name: string;
  price: string;
  currency: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
};

type LandingContent = {
  brand: {
    name: string;
    badge: string;
    dashboardUrl?: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    trustLine: string;
  };
  features: Array<{ title: string; text: string }>;
  plans: LandingPlan[];
  faqs: Array<{ question: string; answer: string }>;
  whatsapp: {
    phoneNumber: string;
    message: string;
    buttonLabel: string;
  };
  finalCta: {
    title: string;
    subtitle: string;
    buttonLabel: string;
  };
  isPublished: boolean;
};

const emptyPlan: LandingPlan = {
  id: 'custom',
  name: 'باقة جديدة',
  price: '99',
  currency: 'USD',
  period: 'شهرياً',
  description: 'وصف مختصر للباقة',
  features: ['ميزة أولى', 'ميزة ثانية'],
  highlighted: false,
  cta: 'اطلب الباقة',
};

export function LandingEditorPage() {
  const { token } = useAuth();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<LandingContent>('/landing/admin', {}, token);
      setContent(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  function updatePlan(index: number, patch: Partial<LandingPlan>) {
    if (!content) return;
    setContent({
      ...content,
      plans: content.plans.map((plan, planIndex) =>
        planIndex === index ? { ...plan, ...patch } : plan,
      ),
    });
  }

  function updatePlanFeatures(index: number, value: string) {
    updatePlan(index, {
      features: value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }

  function updateFeature(index: number, patch: Partial<{ title: string; text: string }>) {
    if (!content) return;
    setContent({
      ...content,
      features: content.features.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function updateFaq(index: number, patch: Partial<{ question: string; answer: string }>) {
    if (!content) return;
    setContent({
      ...content,
      faqs: content.faqs.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!token || !content) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await apiRequest<LandingContent>(
        '/landing/admin',
        {
          method: 'PATCH',
          body: JSON.stringify(content),
        },
        token,
      );
      setContent(saved);
      setMessage('تم حفظ صفحة الهبوط بنجاح.');
    } catch (error: any) {
      setMessage(error?.message || 'تعذر حفظ صفحة الهبوط.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !content) {
    return (
      <div className="page-stack" dir="rtl">
        <div className="card">جارٍ تحميل إعدادات صفحة الهبوط...</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            صفحة البيع العامة
          </p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>إدارة صفحة الهبوط</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a className="btn-secondary" href="http://localhost:5174" target="_blank" rel="noreferrer">
            <Eye size={18} /> معاينة محلية
          </a>
          <button className="btn-primary" form="landing-editor-form" disabled={saving}>
            <Save size={18} /> {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </header>

      {message ? (
        <div className="card" style={{ color: message.includes('تعذر') ? '#b91c1c' : '#047857' }}>
          {message}
        </div>
      ) : null}

      <form id="landing-editor-form" onSubmit={save} className="page-stack" style={{ padding: 0 }}>
        <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>
              <Sparkles size={18} /> العنوان الرئيسي
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              هذا النص هو أول ما يراه العميل عند دخول صفحة البيع.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input
                value={content.brand.name}
                onChange={(event) =>
                  setContent({ ...content, brand: { ...content.brand, name: event.target.value } })
                }
                placeholder="اسم الخدمة"
              />
              <input
                value={content.brand.badge}
                onChange={(event) =>
                  setContent({ ...content, brand: { ...content.brand, badge: event.target.value } })
                }
                placeholder="وسم صغير"
              />
            </div>
            <input
              value={content.hero.eyebrow}
              onChange={(event) =>
                setContent({ ...content, hero: { ...content.hero, eyebrow: event.target.value } })
              }
              placeholder="النص العلوي"
            />
            <input
              value={content.hero.title}
              onChange={(event) =>
                setContent({ ...content, hero: { ...content.hero, title: event.target.value } })
              }
              placeholder="العنوان"
            />
            <textarea
              value={content.hero.subtitle}
              onChange={(event) =>
                setContent({ ...content, hero: { ...content.hero, subtitle: event.target.value } })
              }
              rows={3}
              placeholder="الوصف الرئيسي"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: '1rem' }}>
              <input
                value={content.hero.primaryCta}
                onChange={(event) =>
                  setContent({ ...content, hero: { ...content.hero, primaryCta: event.target.value } })
                }
                placeholder="زر رئيسي"
              />
              <input
                value={content.hero.secondaryCta}
                onChange={(event) =>
                  setContent({ ...content, hero: { ...content.hero, secondaryCta: event.target.value } })
                }
                placeholder="زر ثانوي"
              />
              <input
                value={content.hero.trustLine}
                onChange={(event) =>
                  setContent({ ...content, hero: { ...content.hero, trustLine: event.target.value } })
                }
                placeholder="سطر ثقة"
              />
            </div>
          </div>
        </section>

        <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>
              <MessageCircle size={18} /> واتساب الطلب
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              عند إرسال الطلب، يتم حفظه في لوحة الإدارة وفتح واتساب على هذا الرقم برسالة احترافية.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <input
              value={content.whatsapp.phoneNumber}
              onChange={(event) =>
                setContent({
                  ...content,
                  whatsapp: { ...content.whatsapp, phoneNumber: event.target.value },
                })
              }
              placeholder="+963..."
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
            <input
              value={content.whatsapp.buttonLabel}
              onChange={(event) =>
                setContent({
                  ...content,
                  whatsapp: { ...content.whatsapp, buttonLabel: event.target.value },
                })
              }
              placeholder="نص زر واتساب"
            />
            <textarea
              value={content.whatsapp.message}
              onChange={(event) =>
                setContent({
                  ...content,
                  whatsapp: { ...content.whatsapp, message: event.target.value },
                })
              }
              rows={3}
              placeholder="رسالة واتساب"
            />
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              هذا النص يستخدم كمقدمة للرسالة، وتفاصيل العميل تضاف تلقائياً. المتغيرات المتاحة:{' '}
              <span className="ltr">{'{{planName}}'}</span>, <span className="ltr">{'{{price}}'}</span>,{' '}
              <span className="ltr">{'{{currency}}'}</span>, <span className="ltr">{'{{period}}'}</span>,{' '}
              <span className="ltr">{'{{customerName}}'}</span>, <span className="ltr">{'{{companyName}}'}</span>,{' '}
              <span className="ltr">{'{{phoneNumber}}'}</span>, <span className="ltr">{'{{email}}'}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontWeight: 800 }}>
                <FileText size={18} /> الباقات والأسعار
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                الباقات هنا تظهر مباشرة في صفحة الهبوط.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setContent({ ...content, plans: [...content.plans, { ...emptyPlan }] })}
            >
              <Plus size={18} /> إضافة باقة
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
            {content.plans.map((plan, index) => (
              <div key={`${plan.id}-${index}`} style={{ border: '1px solid var(--border-soft)', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <input value={plan.name} onChange={(event) => updatePlan(index, { name: event.target.value })} />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      setContent({
                        ...content,
                        plans: content.plans.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                    title="حذف الباقة"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <input value={plan.price} onChange={(event) => updatePlan(index, { price: event.target.value })} placeholder="السعر" />
                  <input value={plan.currency} onChange={(event) => updatePlan(index, { currency: event.target.value })} placeholder="العملة" />
                  <input value={plan.period} onChange={(event) => updatePlan(index, { period: event.target.value })} placeholder="الفترة" />
                </div>
                <textarea value={plan.description} onChange={(event) => updatePlan(index, { description: event.target.value })} rows={2} />
                <textarea value={plan.features.join('\n')} onChange={(event) => updatePlanFeatures(index, event.target.value)} rows={5} placeholder="كل ميزة بسطر" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                  <input value={plan.cta} onChange={(event) => updatePlan(index, { cta: event.target.value })} placeholder="زر الباقة" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={plan.highlighted}
                      onChange={(event) => updatePlan(index, { highlighted: event.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    مميزة
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontWeight: 800, marginBottom: '1rem' }}>المزايا</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {content.features.map((feature, index) => (
                <div key={index} style={{ display: 'grid', gap: '0.5rem' }}>
                  <input value={feature.title} onChange={(event) => updateFeature(index, { title: event.target.value })} />
                  <textarea value={feature.text} onChange={(event) => updateFeature(index, { text: event.target.value })} rows={2} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontWeight: 800, marginBottom: '1rem' }}>الأسئلة الشائعة</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {content.faqs.map((faq, index) => (
                <div key={index} style={{ display: 'grid', gap: '0.5rem' }}>
                  <input value={faq.question} onChange={(event) => updateFaq(index, { question: event.target.value })} />
                  <textarea value={faq.answer} onChange={(event) => updateFaq(index, { answer: event.target.value })} rows={2} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <input
            value={content.finalCta.title}
            onChange={(event) =>
              setContent({ ...content, finalCta: { ...content.finalCta, title: event.target.value } })
            }
            placeholder="عنوان الخاتمة"
          />
          <input
            value={content.finalCta.subtitle}
            onChange={(event) =>
              setContent({ ...content, finalCta: { ...content.finalCta, subtitle: event.target.value } })
            }
            placeholder="نص الخاتمة"
          />
          <input
            value={content.finalCta.buttonLabel}
            onChange={(event) =>
              setContent({ ...content, finalCta: { ...content.finalCta, buttonLabel: event.target.value } })
            }
            placeholder="زر الخاتمة"
          />
        </section>
      </form>
    </motion.div>
  );
}
