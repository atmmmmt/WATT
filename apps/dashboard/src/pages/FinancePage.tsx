import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  TrendingUp, 
  Wallet, 
  Clock, 
  CheckCircle2,
  FileText,
  Search,
  Loader2
} from 'lucide-react';
import { exportFinanceReportPdf } from '../lib/export-finance-report-pdf';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Transaction {
  id: string;
  type: 'sale' | 'withdrawal';
  amount: number;
  clientName?: string;
  packageName?: string;
  description: string;
  date: string;
  status: 'completed' | 'pending';
}

export function FinancePage() {
  const { token } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'withdrawals'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'sale' | 'withdrawal'>('sale');
  const [search, setSearch] = useState('');

  // Load real transactions from tenants subscriptions
  useEffect(() => {
    if (!token) return;
    async function load() {
      setLoading(true);
      try {
        const tenants = await apiRequest<any[]>('/tenants', {}, token);
        const saleTxs: Transaction[] = tenants
          .filter(t => t.subscription?.price)
          .map(t => ({
            id: `sale-${t.id || t._id}`,
            type: 'sale' as const,
            amount: t.subscription.price,
            clientName: t.name,
            packageName: t.subscription.planName,
            description: `اشتراك ${t.subscription.planName}`,
            date: (t.subscription.createdAt || t.createdAt || new Date().toISOString()).split('T')[0],
            status: 'completed' as const,
          }));
        setTransactions(saleTxs);
      } catch (e) {
        console.error('Failed to load finance data', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const stats = useMemo(() => {
    const totalSales = transactions.filter(t => t.type === 'sale').reduce((acc, t) => acc + t.amount, 0);
    const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
    return {
      revenue: totalSales,
      withdrawals: totalWithdrawals,
      profit: totalSales - totalWithdrawals
    };
  }, [transactions]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = Number(formData.get('amount'));
    const desc = formData.get('description') as string;
    const date = formData.get('date') as string;

    const newTx: Transaction = {
      id: Math.random().toString(36).substring(7),
      type: modalType,
      amount,
      description: modalType === 'sale' ? `بيع يدوي: ${desc}` : desc,
      clientName: modalType === 'sale' ? desc : undefined,
      date: date || new Date().toISOString().split('T')[0],
      status: 'completed'
    };

    setTransactions([newTx, ...transactions]);
    setShowAddModal(false);
  }

  const filtered = transactions.filter(t => {
    if (activeTab === 'sales' && t.type !== 'sale') return false;
    if (activeTab === 'withdrawals' && t.type !== 'withdrawal') return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.clientName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleExportReport() {
    exportFinanceReportPdf({
      monthName: 'أيار (مايو)',
      year: '2026',
      totalRevenue: stats.revenue,
      totalWithdrawals: stats.withdrawals,
      netProfit: stats.profit,
      transactions: transactions.map(t => ({
        date: t.date,
        description: t.clientName || t.description,
        amount: t.amount,
        type: t.type
      }))
    });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>الإدارة المالية والمحاسبة</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>العمليات المالية</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-ghost" style={{ border: '1px solid var(--border-soft)' }} onClick={handleExportReport}>
            <FileText size={18} /> تحميل تقرير مالي (PDF)
          </button>
          <button className="btn-secondary" onClick={() => { setModalType('withdrawal'); setShowAddModal(true); }}>
            <ArrowUpCircle size={18} /> تسجيل سحب جديد
          </button>
          <button className="btn-primary" onClick={() => { setModalType('sale'); setShowAddModal(true); }}>
            <DollarSign size={18} /> تسجيل بيع يدوي
          </button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ background: '#064E3B', color: 'white', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <TrendingUp size={24} opacity={0.8} />
            <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '20px' }}>الإيرادات</span>
          </div>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>${stats.revenue.toLocaleString()}</h3>
          <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>إجمالي عمليات البيع والمبيعات</p>
        </div>

        <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <ArrowUpCircle size={24} color="#ef4444" />
            <span style={{ fontSize: '0.8rem', background: '#fee2e2', color: '#ef4444', padding: '4px 10px', borderRadius: '20px' }}>السحوبات</span>
          </div>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ef4444' }}>${stats.withdrawals.toLocaleString()}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>المصاريف والمسحوبات النقدية</p>
        </div>

        <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <Wallet size={24} color="#10b981" />
            <span style={{ fontSize: '0.8rem', background: '#d1fae5', color: '#10b981', padding: '4px 10px', borderRadius: '20px' }}>صافي الأرباح</span>
          </div>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: '#10b981' }}>${stats.profit.toLocaleString()}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>المبلغ المتوفر حالياً (الربح)</p>
        </div>
      </section>

      <section className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>تحليلات المبيعات (آخر 7 أيام)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>مراقبة نمو الإيرادات اليومي</p>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>+12.5% نمو هذا الأسبوع</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', gap: '1rem', padding: '0 1rem' }}>
          {[
            { day: 'السبت', val: 120 }, { day: 'الأحد', val: 349 }, { day: 'الاثنين', val: 150 },
            { day: 'الثلاثاء', val: 490 }, { day: 'الأربعاء', val: 280 }, { day: 'الخميس', val: 600 }, { day: 'الجمعة', val: 420 },
          ].map((d, i) => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <motion.div initial={{ height: 0 }} animate={{ height: d.val / 3 }} style={{ width: '32px', background: i === 5 ? 'var(--brand-primary)' : 'var(--brand-primary-soft)', borderRadius: '8px 8px 4px 4px', boxShadow: i === 5 ? '0 10px 20px rgba(6, 78, 59, 0.2)' : 'none' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn-${activeTab === 'all' ? 'primary' : 'ghost'}`} onClick={() => setActiveTab('all')}>الكل</button>
          <button className={`btn-${activeTab === 'sales' ? 'primary' : 'ghost'}`} onClick={() => setActiveTab('sales')}>المبيعات</button>
          <button className={`btn-${activeTab === 'withdrawals' ? 'primary' : 'ghost'}`} onClick={() => setActiveTab('withdrawals')}>السحوبات</button>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input placeholder="بحث في العمليات..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingRight: '2.75rem', background: 'var(--bg-main)', border: 'none' }} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-soft)' }}>
              <th style={{ padding: '1.25rem' }}>التاريخ</th>
              <th style={{ padding: '1.25rem' }}>العملية</th>
              <th style={{ padding: '1.25rem' }}>العميل / الوصف</th>
              <th style={{ padding: '1.25rem' }}>القيمة</th>
              <th style={{ padding: '1.25rem' }}>الحالة</th>
              <th style={{ padding: '1.25rem' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem', display: 'block' }} />
                جاري تحميل البيانات المالية...
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                لا توجد عمليات مالية حتى الآن. قم بإضافة عملاء أو تسجيل عملية يدوية.
              </td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td style={{ padding: '1.25rem' }}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={16} color="var(--text-muted)" /> {new Date(t.date).toLocaleDateString('ar-SY')}</div></td>
                <td style={{ padding: '1.25rem' }}>{t.type === 'sale' ? <span style={{ color: '#10b981', fontWeight: 600 }}>+$ المبيعات</span> : <span style={{ color: '#ef4444', fontWeight: 600 }}>-$ السحوبات</span>}</td>
                <td style={{ padding: '1.25rem' }}><div style={{ fontWeight: 600 }}>{t.clientName || t.description}</div>{t.packageName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.packageName}</div>}</td>
                <td style={{ padding: '1.25rem', fontWeight: 700 }}>${t.amount}</td>
                <td style={{ padding: '1.25rem' }}><span style={{ padding: '4px 10px', borderRadius: '20px', background: '#d1fae5', color: '#065f46', fontSize: '0.8rem' }}>ناجحة</span></td>
                <td style={{ padding: '1.25rem' }}><button className="btn-ghost"><FileText size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="card" style={{ width: '450px', padding: 0 }}>
              <div style={{ padding: '1.5rem', background: '#064E3B', color: 'white' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{modalType === 'sale' ? 'تسجيل مبيعات جديدة' : 'تسجيل عملية سحب'}</h2>
              </div>
              <form onSubmit={handleSave} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>{modalType === 'sale' ? 'اسم العميل' : 'سبب السحب'}</label>
                  <input name="description" placeholder={modalType === 'sale' ? 'شركة الهدى' : 'إيجار السيرفرات'} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>المبلغ</label>
                    <input name="amount" type="number" placeholder="0.00" required />
                  </div>
                  <div className="input-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>العملة</label>
                    <select name="currency"><option>USD</option><option>TRY</option></select>
                  </div>
                </div>
                <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1 }}>حفظ العملية</button>
                  <button type="button" className="btn-ghost" onClick={() => setShowAddModal(false)}>إلغاء</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
