import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  CalendarClock,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type LandingOrderStatus = 'new' | 'contacted' | 'won' | 'lost';

type LandingOrder = {
  id: string;
  _id?: string;
  planId: string;
  planSnapshot: {
    name?: string;
    price?: string;
    currency?: string;
    period?: string;
  };
  customerName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  website?: string;
  useCase?: string;
  notes?: string;
  status: LandingOrderStatus;
  whatsappMessage: string;
  whatsappUrl: string;
  createdAt: string;
};

const statusLabels: Record<LandingOrderStatus, string> = {
  new: 'طلب جديد',
  contacted: 'تم التواصل',
  won: 'تم البيع',
  lost: 'لم يتم',
};

const statusColors: Record<LandingOrderStatus, string> = {
  new: '#2563eb',
  contacted: '#f59e0b',
  won: '#10b981',
  lost: '#ef4444',
};

export function LandingOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<LandingOrder[]>([]);
  const [status, setStatus] = useState<'all' | LandingOrderStatus>('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const totals = useMemo(
    () => ({
      all: orders.length,
      new: orders.filter((order) => order.status === 'new').length,
      won: orders.filter((order) => order.status === 'won').length,
    }),
    [orders],
  );

  async function loadOrders() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const query = status === 'all' ? '' : `?status=${status}`;
      const result = await apiRequest<LandingOrder[]>(
        `/landing/admin/orders${query}`,
        {},
        token,
      );
      setOrders(result);
    } catch (error: any) {
      setMessage(error?.message || 'تعذر تحميل الطلبات.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [token, status]);

  async function updateStatus(orderId: string, nextStatus: LandingOrderStatus) {
    if (!token) return;
    try {
      const updated = await apiRequest<LandingOrder>(
        `/landing/admin/orders/${orderId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        },
        token,
      );
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? updated : order)),
      );
    } catch (error: any) {
      setMessage(error?.message || 'تعذر تحديث حالة الطلب.');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>طلبات البيع من صفحة الهبوط</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>طلبات العملاء الجدد</h1>
        </div>
        <button className="btn-secondary" onClick={loadOrders} disabled={loading}>
          <RefreshCw size={18} /> تحديث
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>كل الطلبات</p>
          <strong style={{ fontSize: '2rem' }}>{totals.all}</strong>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>طلبات جديدة</p>
          <strong style={{ fontSize: '2rem', color: '#2563eb' }}>{totals.new}</strong>
        </div>
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>مبيعات مغلقة</p>
          <strong style={{ fontSize: '2rem', color: '#10b981' }}>{totals.won}</strong>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontWeight: 800 }}>فلترة الطلبات</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>غيّر حالة الطلب بعد التواصل مع العميل.</p>
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} style={{ maxWidth: 260 }}>
          <option value="all">كل الحالات</option>
          <option value="new">طلب جديد</option>
          <option value="contacted">تم التواصل</option>
          <option value="won">تم البيع</option>
          <option value="lost">لم يتم</option>
        </select>
      </section>

      {message ? <div className="card" style={{ color: '#b91c1c' }}>{message}</div> : null}

      <section style={{ display: 'grid', gap: '1rem' }}>
        {loading ? <div className="card">جار تحميل الطلبات...</div> : null}
        {!loading && orders.length === 0 ? <div className="card">لا توجد طلبات مطابقة حالياً.</div> : null}

        {orders.map((order) => {
          const planName = order.planSnapshot?.name || order.planId;
          const price = [order.planSnapshot?.currency, order.planSnapshot?.price, order.planSnapshot?.period]
            .filter(Boolean)
            .join(' ');

          return (
            <article
              className="card"
              key={order.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 1fr',
                gap: '1.25rem',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                  <div>
                    <span
                      className="badge"
                      style={{
                        background: `${statusColors[order.status]}18`,
                        color: statusColors[order.status],
                      }}
                    >
                      {statusLabels[order.status]}
                    </span>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.75rem' }}>
                      {order.companyName}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                      {planName} {price ? `- ${price}` : ''}
                    </p>
                  </div>
                  <select
                    value={order.status}
                    onChange={(event) =>
                      updateStatus(order.id, event.target.value as LandingOrderStatus)
                    }
                    style={{ maxWidth: 180 }}
                  >
                    <option value="new">طلب جديد</option>
                    <option value="contacted">تم التواصل</option>
                    <option value="won">تم البيع</option>
                    <option value="lost">لم يتم</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <InfoItem icon={<Building2 size={17} />} label="اسم العميل" value={order.customerName} />
                  <InfoItem icon={<Phone size={17} />} label="الهاتف" value={order.phoneNumber} ltr />
                  <InfoItem icon={<Mail size={17} />} label="البريد" value={order.email} ltr />
                  <InfoItem
                    icon={<CalendarClock size={17} />}
                    label="وقت الطلب"
                    value={new Date(order.createdAt).toLocaleString('ar-SY')}
                  />
                </div>

                {order.useCase || order.website || order.notes ? (
                  <div style={{ display: 'grid', gap: '0.5rem', color: 'var(--text-muted)' }}>
                    {order.website ? <p style={{ margin: 0 }}>الموقع: {order.website}</p> : null}
                    {order.useCase ? <p style={{ margin: 0 }}>الاستخدام المطلوب: {order.useCase}</p> : null}
                    {order.notes ? <p style={{ margin: 0 }}>ملاحظات: {order.notes}</p> : null}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <h3 style={{ fontWeight: 800 }}>رسالة الواتساب المولدة</h3>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    direction: 'rtl',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    color: 'var(--text-main)',
                    lineHeight: 1.8,
                  }}
                >
                  {order.whatsappMessage}
                </pre>
                <a className="btn-primary" href={order.whatsappUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <MessageCircle size={18} /> فتح المحادثة على واتساب
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </motion.div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  ltr,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div style={{ border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {icon}
        {label}
      </div>
      <strong style={{ display: 'block', marginTop: '0.45rem', direction: ltr ? 'ltr' : 'rtl', textAlign: ltr ? 'left' : 'right' }}>
        {value}
      </strong>
    </div>
  );
}
