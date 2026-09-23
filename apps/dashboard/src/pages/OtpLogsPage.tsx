import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Smartphone,
  ExternalLink,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';

interface OtpLog {
  _id: string;
  tenantId: string;
  phoneNumber: string;
  purpose: string;
  status: string;
  attempts: number;
  providerType: string;
  createdAt: string;
}

export function OtpLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<OtpLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<OtpLog[]>('/otp-requests', {}, token)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [token]);

  function statusBadge(status: string) {
    switch (status) {
      case 'verified': return <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={12} /> مكتمل</span>;
      case 'failed': return <span className="badge badge-error" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={12} /> فشل</span>;
      default: return <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' }}><Clock size={12} /> معلق</span>;
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-stack"
      dir="rtl"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow" style={{ textAlign: 'right' }}>السجلات النظامية</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>سجل رسائل التحقق (OTP)</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary"><Download size={18} /> تحميل السجلات</button>
        </div>
      </header>

      <article className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input placeholder="البحث برقم الهاتف..." style={{ paddingRight: '2.5rem', width: '300px', background: 'var(--bg-card)' }} />
            </div>
            <button className="btn-ghost" style={{ border: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}>
              <Filter size={18} /> الفلترة
            </button>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            عرض {logs.length} عملية أخيرة
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-soft)' }}>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>المستلم</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>الغرض</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>الحالة</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>المحاولات</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>المزود</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>التوقيت</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                    <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} />
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log._id} style={{ borderBottom: '1px solid var(--border-soft)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', padding: '0.5rem', borderRadius: '8px' }}>
                        <Smartphone size={16} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.phoneNumber}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{log.purpose}</td>
                  <td style={{ padding: '1rem' }}>{statusBadge(log.status)}</td>
                  <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{log.attempts}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {log.providerType === 'whatsapp_web' ? 'واتساب' : log.providerType}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(log.createdAt).toLocaleString('ar-SY')}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'left' }}>
                    <button className="btn-ghost" style={{ padding: '0.4rem' }}>
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>السابق</button>
            <button className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>التالي</button>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>صفحة 1 من 1</div>
        </div>
      </article>
    </motion.div>
  );
}
