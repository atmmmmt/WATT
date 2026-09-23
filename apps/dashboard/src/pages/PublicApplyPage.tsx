import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Link as LinkIcon, 
  FileText, 
  Send,
  CheckCircle2,
  AlertCircle,
  Zap
} from 'lucide-react';

export function PublicApplyPage() {
  const { jobSlug = '' } = useParams();
  const [job, setJob] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    city: '',
    experience: '',
    expectedSalary: '',
    cvUrl: '',
    notes: '',
  });

  useEffect(() => {
    apiRequest<any>(`/apply/${jobSlug}`)
      .then(setJob)
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : 'الوظيفة غير متاحة'),
      );
  }, [jobSlug]);

  async function apply(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest(`/apply/${jobSlug}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setNotice('تم إرسال طلبك بنجاح. سيتواصل معك فريق التوظيف قريباً.');
      setForm({
        fullName: '',
        phoneNumber: '',
        email: '',
        city: '',
        experience: '',
        expectedSalary: '',
        cvUrl: '',
        notes: '',
      });
    } catch (e) {
      setError('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-main)', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: "'Readex Pro', sans-serif"
    }} dir="rtl">
      
      {/* Dynamic Background */}
      <div style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, height: '400px', 
        background: '#064E3B',
        zIndex: 0
      }}>
        <div style={{ 
          position: 'absolute', top: '-10%', right: '-5%', width: '300px', height: '300px', 
          background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(60px)' 
        }} />
      </div>

      <main style={{ position: 'relative', zIndex: 1, padding: '4rem 2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '3rem', color: 'white', textAlign: 'center' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', marginBottom: '1.5rem', backdropFilter: 'blur(10px)' }}>
            <Zap size={18} fill="white" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>بوابة التوظيف الذكية</span>
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem' }}>{job?.title || 'جاري التحميل...'}</h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>{job?.description || 'يرجى ملء النموذج أدناه للانضمام إلى فريق عملنا المتميز.'}</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2rem' }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="card" 
            style={{ padding: '3rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', borderRadius: 'var(--radius-xl)' }}
          >
            <AnimatePresence>
              {notice && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  style={{ background: 'var(--status-success)', color: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
                >
                  <CheckCircle2 size={24} />
                  <div>
                    <div style={{ fontWeight: 700 }}>تم بنجاح!</div>
                    <div style={{ fontSize: '0.9rem' }}>{notice}</div>
                  </div>
                </motion.div>
              )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(220, 38, 38, 0.2)' }}
                >
                  <AlertCircle size={20} />
                  <span style={{ fontWeight: 600 }}>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={apply} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>الاسم الكامل</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                    <input style={{ paddingRight: '3rem' }} placeholder="أدخل اسمك الثلاثي" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>رقم الهاتف (WhatsApp)</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                    <input style={{ paddingRight: '3rem' }} placeholder="+966..." value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>البريد الإلكتروني</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                    <input style={{ paddingRight: '3rem' }} type="email" placeholder="example@mail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>المدينة</label>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                    <input style={{ paddingRight: '3rem' }} placeholder="أين تقيم حالياً؟" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>ملخص الخبرة</label>
                  <div style={{ position: 'relative' }}>
                    <Briefcase size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                    <input style={{ paddingRight: '3rem' }} placeholder="مثال: 5 سنوات في المبيعات" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>الراتب المتوقع (شهرياً)</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                    <input style={{ paddingRight: '3rem' }} placeholder="بالريال السعودي" value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} required />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>رابط السيرة الذاتية (Google Drive / Dropbox)</label>
                <div style={{ position: 'relative' }}>
                  <LinkIcon size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-primary)' }} />
                  <input style={{ paddingRight: '3rem' }} placeholder="https://..." value={form.cvUrl} onChange={(e) => setForm({ ...form, cvUrl: e.target.value })} required />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>تأكد من أن الرابط متاح للعرض العام.</p>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>ملاحظات إضافية</label>
                <div style={{ position: 'relative' }}>
                  <FileText size={18} style={{ position: 'absolute', right: '1rem', top: '1.2rem', color: 'var(--brand-primary)' }} />
                  <textarea style={{ paddingRight: '3rem', minHeight: '120px' }} placeholder="أخبرنا المزيد عن مهاراتك..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={isSubmitting}
                style={{ padding: '1.25rem', fontSize: '1.1rem', width: '100%', justifyContent: 'center', gap: '1rem' }}
              >
                {isSubmitting ? 'جاري الإرسال...' : 'تقديم طلب التوظيف'}
                <Send size={20} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </form>
          </motion.div>
        </div>
      </main>

      <footer style={{ marginTop: 'auto', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        &copy; 2026 VAYRO Platform. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
