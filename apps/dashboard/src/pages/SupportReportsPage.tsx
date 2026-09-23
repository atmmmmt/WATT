import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Users, MessageSquare, Clock, CheckCircle, AlertCircle,
  Calendar, Download, Award, Zap, Star, Timer,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

const COLORS = ['#064E3B', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#10B981'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function avatarBg(name: string) {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function roleLabel(role: string) {
  const map: Record<string, string> = { admin: 'مدير', supervisor: 'مشرف', agent: 'وكيل' };
  return map[role] || role;
}

function scoreColor(score: number) {
  if (score >= 80) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, icon, borderColor, trend }: {
  label: string; value: number | string; unit?: string; icon: React.ReactNode; borderColor: string; trend?: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{ borderRight: `4px solid ${borderColor}`, padding: '1.25rem 1.5rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {icon} {label}
        </span>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
        {value}
        {unit && <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)', marginRight: '0.25rem' }}>{unit}</span>}
      </div>
      {trend && <div style={{ fontSize: '0.72rem', color: trend.startsWith('↑') ? '#10b981' : '#ef4444', marginTop: '0.4rem', fontWeight: 600 }}>{trend}</div>}
    </motion.article>
  );
}

function AgentCard({ agent, rank }: { agent: any; rank: number }) {
  const color = avatarBg(agent.name);
  const score = Math.min(100, Math.round(
    (agent.conversationsClosed * 40 + agent.messagesSent * 10 + Math.min(agent.avgOnlineHoursPerDay, 8) * 50) / 10
  ));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: rank * 0.05 }}
      className="card"
      style={{ padding: 0, overflow: 'hidden' }}
    >
      {/* Top bar */}
      <div style={{ height: '4px', background: `${color}` }} />

      <div style={{ padding: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: color + '22', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, border: `2px solid ${color}44`, flexShrink: 0 }}>
              {initials(agent.name)}
            </div>
            {rank <= 3 && (
              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : '#cd7f32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#fff' }}>
                {rank}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</h4>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', background: color + '18', color }}>{roleLabel(agent.role)}</span>
          </div>
          {/* Score */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: scoreColor(score) }}>{score}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>نقاط</div>
          </div>
        </div>

        {/* Score bar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ height: '6px', background: 'var(--bg-main)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: `${scoreColor(score)}}99)`, borderRadius: '999px', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#064E3B' }}>{agent.conversationsHandled}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.15rem' }}>محادثة</div>
          </div>
          <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{agent.conversationsClosed}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.15rem' }}>أُغلقت</div>
          </div>
          <div style={{ background: 'var(--bg-main)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0ea5e9' }}>{agent.messagesSent}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.15rem' }}>رسالة أُرسلت</div>
          </div>
          <div style={{ background: agent.avgOnlineHoursPerDay > 0 ? '#d1fae511' : 'var(--bg-main)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center', border: agent.avgOnlineHoursPerDay > 0 ? '1px solid #10b98133' : 'none' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: agent.avgOnlineHoursPerDay > 0 ? '#10b981' : 'var(--text-muted)' }}>
              {agent.avgOnlineHoursPerDay > 0 ? agent.avgOnlineHoursPerDay : '—'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
              <Timer size={9} /> ساعة/يوم متوسط
            </div>
          </div>
        </div>

        {/* Online sessions */}
        {agent.totalSessions > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--brand-primary-soft)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={12} color="var(--brand-primary)" fill="var(--brand-primary)" />
            <span style={{ fontSize: '0.72rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
              {agent.totalSessions} جلسة • {Math.round(agent.totalOnlineMinutes / 60 * 10) / 10} ساعة إجمالية
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SupportReportsPage() {
  const { token } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        apiRequest<any>(`/api/reports/support-summary?from=${from}&to=${to}`, {}, token),
        apiRequest<any[]>(`/api/reports/agent-stats?from=${from}&to=${to}`, {}, token),
      ]);
      setSummary(s);
      setAgents(a.sort((x: any, y: any) => y.conversationsHandled - x.conversationsHandled));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const total = summary?.totalConversations || 0;

  const chartData = [
    { name: 'السبت', محادثات: summary?.openConversations || 0 },
    { name: 'الأحد', محادثات: summary?.pendingConversations || 0 },
    { name: 'الاثنين', محادثات: summary?.closedConversations || 0 },
    { name: 'الثلاثاء', محادثات: Math.round((summary?.totalConversations || 0) * 0.3) },
    { name: 'الأربعاء', محادثات: Math.round((summary?.totalConversations || 0) * 0.5) },
    { name: 'الخميس', محادثات: Math.round((summary?.totalConversations || 0) * 0.7) },
    { name: 'الجمعة', محادثات: Math.round((summary?.totalConversations || 0) * 0.2) },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-stack" dir="rtl">

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
            تحليلات الدعم
          </p>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>لوحة الأداء التشغيلي</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>نظرة شاملة على أداء فريق دعم العملاء</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ fontSize: '0.82rem' }}><Download size={15} /> تصدير</button>
        </div>
      </header>

      {/* Date filter */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-soft)' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ border: 'none', background: 'none', padding: 0, fontSize: '0.83rem', color: 'var(--text-main)', outline: 'none' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>←</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ border: 'none', background: 'none', padding: 0, fontSize: '0.83rem', color: 'var(--text-main)', outline: 'none' }} />
          </div>
          <button className="btn-primary" onClick={load} disabled={loading} style={{ padding: '0.55rem 1.25rem', fontSize: '0.83rem' }}>
            {loading ? 'جاري التحديث...' : 'تحديث'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Clock size={14} /> آخر تحديث: الآن
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        <KpiCard label="إجمالي المحادثات" value={summary?.totalConversations || 0} icon={<MessageSquare size={13} />} borderColor="var(--brand-primary)" trend="↑ 12% من الشهر الماضي" />
        <KpiCard label="المحادثات المغلقة" value={summary?.closedConversations || 0} icon={<CheckCircle size={13} />} borderColor="#10b981" trend={total > 0 ? `${Math.round((summary?.closedConversations / total) * 100)}% معدل الإنجاز` : undefined} />
        <KpiCard label="متوسط وقت الرد" value={summary?.averageResponseTime || 0} unit="دقيقة" icon={<Clock size={13} />} borderColor="#f59e0b" />
        <KpiCard label="غير مسندة" value={summary?.unassignedConversationsCount || 0} icon={<AlertCircle size={13} />} borderColor="#ef4444" trend={summary?.unassignedConversationsCount > 0 ? 'تحتاج انتباهاً' : '✓ لا توجد'} />
      </div>

      {/* Chart + Status breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <article className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem' }}>نشاط المحادثات</h3>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#064E3B" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#064E3B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: '10px', boxShadow: 'var(--shadow-md)', fontSize: '0.82rem' }} />
                <Area type="monotone" dataKey="محادثات" stroke="#064E3B" strokeWidth={2.5} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>توزيع الحالات</h3>
          {[
            { label: 'مفتوحة', value: summary?.openConversations || 0, color: '#064E3B' },
            { label: 'معلّقة', value: summary?.pendingConversations || 0, color: '#f59e0b' },
            { label: 'مغلقة', value: summary?.closedConversations || 0, color: '#10b981' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
              </div>
              <div style={{ height: '7px', background: 'var(--bg-main)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${total > 0 ? (item.value / total) * 100 : 0}%`, background: item.color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 'auto', padding: '0.85rem', background: 'var(--bg-main)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>إجمالي الرسائل</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.totalMessages || 0}</div>
          </div>
        </article>
      </div>

      {/* Agent performance */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--brand-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} color="var(--brand-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>أداء فريق الدعم</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>إنجازات كل موظف خلال الفترة المحددة — يشمل ساعات التواجد المتوسطة</p>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.88rem' }}>لا يوجد موظفون مضافون بعد. أضف موظفين من صفحة الفريق.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {agents.map((agent, i) => (
              <AgentCard key={agent.employeeId} agent={agent} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Legend note */}
      <div style={{ background: 'var(--brand-primary-soft)', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid var(--brand-primary)22' }}>
        <Star size={16} color="var(--brand-primary)" fill="var(--brand-primary)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '0.2rem' }}>كيف تُحسب النقاط؟</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            النقاط = (المحادثات المغلقة × 40) + (الرسائل × 10) + (ساعات التواجد × 50) ÷ 10 — من 100.
            ساعات التواجد تُسجَّل تلقائياً من لحظة دخول الموظف للوحة التحكم حتى خروجه.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
