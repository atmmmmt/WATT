import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit3, 
  Zap, 
  MessageSquare, 
  Briefcase, 
  ShieldCheck,
  X
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  quota: number;
  services: string[];
  description: string;
  durationMonths: number;
}

export const DEFAULT_PLANS: Plan[] = [
  { 
    id: 'otp', 
    name: 'باقة التحقق (WhatsApp OTP)', 
    price: 49, 
    quota: 1000, 
    services: ['api'],
    description: 'مثالية للمشاريع الناشئة والتحقق من رقم الهاتف عبر API.',
    durationMonths: 1
  },
  { 
    id: 'support', 
    name: 'باقة خدمة العملاء (Support)', 
    price: 149, 
    quota: 5000, 
    services: ['support'],
    description: 'صندوق وارد موحد لعدة موظفين مع ربط واتساب.',
    durationMonths: 12
  },
  { 
    id: 'hr', 
    name: 'باقة التوظيف الذكي (HR Hub)', 
    price: 149, 
    quota: 5000, 
    services: ['hr'],
    description: 'إدارة كاملة للمرشحين والوظائف عبر واتساب.',
    durationMonths: 12
  },
  { 
    id: 'all', 
    name: 'الباقة الشاملة (All-in-One)', 
    price: 299, 
    quota: 25000, 
    services: ['api', 'support', 'hr'],
    description: 'الحل الكامل للشركات: OTP + دعم + توظيف.',
    durationMonths: 60
  }
];

export function PackagesPage() {
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [form, setForm] = useState<Omit<Plan, 'id'>>({
    name: '',
    price: 0,
    quota: 0,
    services: [],
    description: '',
    durationMonths: 12
  });

  function openCreate() {
    setEditingPlan(null);
    setForm({ name: '', price: 0, quota: 0, services: [], description: '', durationMonths: 12 });
    setShowModal(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      price: plan.price,
      quota: plan.quota,
      services: plan.services,
      description: plan.description,
      durationMonths: plan.durationMonths
    });
    setShowModal(true);
  }

  function handleDelete(id: string) {
    if (confirm('هل أنت متأكد من حذف هذه الباقة؟')) {
      setPlans(plans.filter(p => p.id !== id));
    }
  }

  function handleSave() {
    if (editingPlan) {
      setPlans(plans.map(p => p.id === editingPlan.id ? { ...form, id: p.id } : p));
    } else {
      const newPlan = { ...form, id: Math.random().toString(36).substring(7) };
      setPlans([...plans, newPlan]);
    }
    setShowModal(false);
  }

  const toggleService = (service: string) => {
    setForm(prev => ({
      ...prev,
      services: prev.services.includes(service) 
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إدارة المنتجات والأسعار</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>الباقات والأسعار</h1>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={20} /> إنشاء باقة جديدة
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {plans.map((plan) => (
          <motion.div layout key={plan.id} className="card" style={{ border: plan.services.length > 2 ? '2px solid #064E3B' : '1px solid var(--border-soft)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#064E3B15', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-ghost" style={{ padding: '0.5rem' }} onClick={() => openEdit(plan)}><Edit3 size={16} /></button>
                <button className="btn-ghost" style={{ padding: '0.5rem', color: '#ef4444' }} onClick={() => handleDelete(plan.id)}><Trash2 size={16} /></button>
              </div>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{plan.name}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', minHeight: '40px' }}>{plan.description}</p>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#064E3B' }}>
                ${plan.price} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ 
                {plan.durationMonths === 1 ? 'شهرياً' : 
                 plan.durationMonths === 12 ? 'سنوياً' : 
                 `لمدة ${plan.durationMonths} شهر`}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {plan.services.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  {s === 'api' && <><Zap size={16} color="#f59e0b" /> بوابة OTP & API</>}
                  {s === 'support' && <><MessageSquare size={16} color="#3b82f6" /> صندوق الدعم الفني</>}
                  {s === 'hr' && <><Briefcase size={16} color="#10b981" /> نظام التوظيف</>}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <ShieldCheck size={16} color="#064E3B" /> {plan.quota.toLocaleString()} رسالة شهرياً
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card" style={{ width: '500px', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', background: '#064E3B', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingPlan ? 'تعديل باقة' : 'إنشاء باقة جديدة'}</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>اسم الباقة</label>
                  <input placeholder="مثلاً: الباقة الشاملة" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>السعر ($)</label>
                    <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} />
                  </div>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>مدة الباقة</label>
                    <select value={form.durationMonths} onChange={e => setForm({...form, durationMonths: Number(e.target.value)})}>
                      <option value="1">شهر واحد</option>
                      <option value="6">6 أشهر</option>
                      <option value="12">سنة واحدة</option>
                      <option value="24">سنتين</option>
                      <option value="60">5 سنوات</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>الرسائل الشهرية</label>
                  <input type="number" value={form.quota} onChange={e => setForm({...form, quota: Number(e.target.value)})} />
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>وصف الباقة</label>
                  <textarea style={{ minHeight: '80px' }} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>

                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>الخدمات المشمولة</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'api', label: 'OTP & API', color: '#f59e0b' },
                      { id: 'support', label: 'الدعم الفني', color: '#3b82f6' },
                      { id: 'hr', label: 'التوظيف', color: '#10b981' }
                    ].map(s => (
                      <button 
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        style={{ 
                          padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid ' + (form.services.includes(s.id) ? s.color : '#ddd'),
                          background: form.services.includes(s.id) ? s.color + '15' : 'white',
                          color: form.services.includes(s.id) ? s.color : '#666',
                          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave}>حفظ التغييرات</button>
                  <button className="btn-ghost" style={{ flex: 1, border: '1px solid #ddd' }} onClick={() => setShowModal(false)}>إلغاء</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
