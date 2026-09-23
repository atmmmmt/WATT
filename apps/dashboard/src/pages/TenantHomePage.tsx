import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Activity, AlertCircle, Award, CheckCircle2, Clock, Copy,
  Key, MessageSquare, QrCode, RefreshCw, Send, Smartphone,
  TrendingUp, Users, Wifi, WifiOff, Zap, Star, Timer,
  ChevronUp, ChevronDown, Minus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, apiRequest } from '../lib/api';

/* ─── helpers ───────────────────────────────────────────── */
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function sessionInfo(s?: string): { text: string; color: string; bg: string; dot: string } {
  if (s === 'ready')         return { text: 'متصل وجاهز',     color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' };
  if (s === 'qr_ready')     return { text: 'بانتظار المسح',   color: '#d97706', bg: '#fef9c3', dot: '#eab308' };
  if (s === 'initializing') return { text: 'جاري التجهيز',   color: '#2563eb', bg: '#dbeafe', dot: '#3b82f6' };
  return                           { text: 'غير متصل',         color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' };
}

const AGENT_COLORS = ['#064E3B','#0ea5e9','#10b981','#f59e0b','#ef4444','#10B981'];
function avatarBg(name: string) {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AGENT_COLORS[Math.abs(h) % AGENT_COLORS.length];
}
function initials(name: string) {
  return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
}

/* ─── types ────────────────────────────────────────────── */
interface TenantInfo {
  _id?: string; id?: string; name: string; slug: string; contactEmail: string;
  subscription?: { planName: string; price: number; currency: string; endsAt: string; maxMonthlyOtp: number } | null;
  provider?: { providerType: string; status: string } | null;
  whatsappSession?: { status: string; phoneNumber?: string | null; displayName?: string | null; qrDataUrl?: string | null } | null;
}
interface ApiKeyRow { _id?: string; id?: string; name: string; keyPrefix: string; scopes: string[]; status: string; }
interface Summary {
  totalConversations: number;
  openConversations: number;
  closedConversations: number;
  pendingConversations: number;
  averageFirstResponseTime: number | null;
  averageResponseTime: number | null;
  totalMessages: number;
  unassignedConversationsCount: number;
}
interface AgentStat {
  employeeId: string; name: string; role: string; email: string;
  conversationsHandled: number; conversationsClosed: number;
  messagesSent: number; avgOnlineHoursPerDay: number;
  totalSessions: number; totalOnlineMinutes: number;
}

/* ─── micro components ──────────────────────────────────── */
function KpiCard({ icon, label, value, sub, color = '#064E3B', trend }: {
  icon: React.ReactNode; label: string; value: string|number; sub?: string;
  color?: string; trend?: 'up'|'down'|'flat';
}) {
  return (
    <article style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: '18px',
      padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
      boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: `${color}12` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color }}>{icon}</span> {label}
        </span>
        {trend && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px',
            color: trend === 'up' ? '#16a34a' : trend === 'down' ? '#dc2626' : '#6b7280' }}>
            {trend === 'up' ? <ChevronUp size={14}/> : trend === 'down' ? <ChevronDown size={14}/> : <Minus size={14}/>}
          </span>
        )}
      </div>
      <p style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--text-main)' }}>{value}</p>
      {sub && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</p>}
    </article>
  );
}

function AgentRow({ agent, rank }: { agent: AgentStat; rank: number }) {
  const score = Math.min(100, Math.round(
    (agent.conversationsClosed * 2 + agent.messagesSent * 0.5 + Math.min(agent.avgOnlineHoursPerDay,8)*5)
  ));
  const scoreColor = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#ef4444';
  const bg = avatarBg(agent.name);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem',
      borderRadius: '14px', background: rank === 0 ? '#E8F6F0' : 'var(--bg-main)',
      border: `1px solid ${rank === 0 ? '#A7F3D0' : 'var(--border-soft)'}`,
    }}>
      {/* Rank */}
      <div style={{ width: 26, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem',
        color: rank === 0 ? '#065F46' : rank === 1 ? '#d97706' : 'var(--text-muted)' }}>
        {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank+1}`}
      </div>
      {/* Avatar */}
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: bg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>
        {initials(agent.name)}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {agent.conversationsClosed} محادثة مغلقة · {agent.messagesSent} رسالة
        </p>
      </div>
      {/* Score bar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: scoreColor }}>{score}</span>
        <div style={{ width: 60, height: 5, borderRadius: 9, background: 'var(--border-soft)' }}>
          <div style={{ width: `${score}%`, height: '100%', borderRadius: 9, background: scoreColor, transition: 'width 0.6s ease' }} />
        </div>
      </div>
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────── */
export function TenantHomePage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'ok'|'err'>('ok');
  const [latestRawKey, setLatestRawKey] = useState('');
  const [debugError, setDebugError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [tenants, apiKeys] = await Promise.all([
        apiRequest<TenantInfo[]>('/tenants', {}, token),
        apiRequest<ApiKeyRow[]>('/api-keys', {}, token),
      ]);
      setTenant(tenants?.[0] || null);
      setKeys(apiKeys || []);
    } catch {}

    const from90 = daysAgo(90);
    const from30 = daysAgo(30);
    const to = todayStr();

    try {
      const s = await apiRequest<Summary>(`/api/reports/support-summary?from=${from90}&to=${to}`, {}, token);
      if (s) setSummary(s);
    } catch(e: any) {
      console.error('[TenantHome] summary error:', e);
      setDebugError(`summary: ${e?.message || e}`);
    }

    try {
      const a = await apiRequest<AgentStat[]>(`/api/reports/agent-stats?from=${from30}&to=${to}`, {}, token);
      if (Array.isArray(a)) setAgents(a.sort((x,y) => y.conversationsHandled - x.conversationsHandled));
    } catch(e: any) {
      console.error('[TenantHome] agent-stats error:', e);
      setDebugError(prev => prev ? `${prev} | agent-stats: ${e?.message || e}` : `agent-stats: ${e?.message || e}`);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function toast(msg: string, type: 'ok'|'err' = 'ok') {
    setNotice(msg); setNoticeType(type);
    setTimeout(() => setNotice(''), 4000);
  }

  async function startQr() {
    setBusy('start');
    try {
      const s = await apiRequest<any>('/whatsapp-sessions/start', { method: 'POST' }, token!);
      setTenant(t => t ? { ...t, whatsappSession: s } : t);
    } catch { toast('فشل بدء الجلسة','err'); } finally { setBusy(null); }
  }

  async function refreshSession() {
    if (!tenant) return;
    setBusy('ref');
    try {
      const s = await apiRequest<any>(`/whatsapp-sessions/${tenant.id||tenant._id}`, {}, token!);
      setTenant(t => t ? { ...t, whatsappSession: s } : t);
    } finally { setBusy(null); }
  }

  async function disconnect() {
    setBusy('dis');
    try {
      const s = await apiRequest<any>('/whatsapp-sessions/disconnect', { method: 'POST' }, token!);
      setTenant(t => t ? { ...t, whatsappSession: s } : t);
    } finally { setBusy(null); }
  }

  async function issueKey() {
    setBusy('key');
    try {
      const r = await apiRequest<any>('/api-keys', { method:'POST', body: JSON.stringify({
        name: `Client Key ${new Date().toISOString().slice(0,10)}`,
        scopes: ['otp:send','otp:verify','whatsapp:session'],
      })}, token!);
      setLatestRawKey(r.rawKey);
      toast('تم إصدار مفتاح جديد — احفظه الآن');
      load();
    } catch { toast('فشل إصدار المفتاح','err'); } finally { setBusy(null); }
  }

  function copy(t: string, m='تم النسخ') { navigator.clipboard.writeText(t).then(()=>toast(m)); }

  /* derived */
  const sess = tenant?.whatsappSession;
  const si = sessionInfo(sess?.status);
  const quota = tenant?.subscription?.maxMonthlyOtp || 0;
  const daysLeft = tenant?.subscription?.endsAt
    ? Math.max(0, Math.ceil((new Date(tenant.subscription.endsAt).getTime() - Date.now()) / 86400000)) : 0;
  const activeKeys = keys.filter(k => k.status === 'active');
  const docsUrl = `${API_BASE_URL.replace(/\/$/,'')}/docs`;

  const resolutionRate = summary && summary.totalConversations > 0
    ? Math.round(summary.closedConversations / summary.totalConversations * 100) : 0;

  /* chart data — daily breakdown of open/closed */
  const chartData = summary ? [
    { name: 'مفتوحة', value: summary.openConversations, fill: '#064E3B' },
    { name: 'معلقة',  value: summary.pendingConversations, fill: '#f59e0b' },
    { name: 'مغلقة',  value: summary.closedConversations, fill: '#10b981' },
  ] : [];

  const agentsChartData = agents.slice(0,6).map(a => ({
    name: a.name.split(' ')[0],
    رسائل: a.messagesSent,
    محادثات: a.conversationsClosed,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="page-stack" dir="rtl">

      {/* ── Header ─────────────────────────────────── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>لوحة التحكم الرئيسية</p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            مرحباً{user?.name ? `، ${user.name}` : ''} 👋
          </h1>
          {tenant?.name && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {tenant.name} &nbsp;·&nbsp; {tenant.subscription?.planName || 'غير مفعلة'}
              &nbsp;·&nbsp; <span style={{ color: daysLeft < 14 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{daysLeft} يوم متبقي</span>
            </p>
          )}
        </div>
        <button className="btn-secondary" onClick={load} disabled={!!busy}>
          <RefreshCw size={15} className={busy === 'ref' ? 'animate-spin' : ''} /> تحديث
        </button>
      </header>

      {/* ── Debug error (temp) ─────────────────────── */}
      {debugError && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:12, padding:'0.75rem 1rem', fontSize:'0.8rem', color:'#991b1b', fontFamily:'monospace' }}>
          ⚠️ خطأ في تحميل بيانات التقارير: {debugError}
        </div>
      )}

      {/* ── Toast ──────────────────────────────────── */}
      {notice && (
        <div style={{ padding:'0.8rem 1.2rem', borderRadius:'12px', fontSize:'0.86rem', fontWeight:600,
          background: noticeType==='ok'?'#dcfce7':'#fee2e2', color: noticeType==='ok'?'#166534':'#991b1b',
          border:`1px solid ${noticeType==='ok'?'#86efac':'#fca5a5'}`,
          display:'flex', alignItems:'center', gap:'0.5rem' }}>
          {noticeType==='ok'?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>} {notice}
        </div>
      )}

      {/* ── Raw Key ────────────────────────────────── */}
      {latestRawKey && (
        <div style={{ background:'#faf5ff', border:'1.5px solid var(--brand-primary)', borderRadius:'14px', padding:'1rem 1.5rem' }}>
          <p style={{ fontWeight:700, color:'var(--brand-primary)', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <Key size={15}/> مفتاح API — انسخه الآن، لن يظهر مجدداً
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:'var(--bg-main)', borderRadius:'10px', padding:'0.6rem 1rem' }}>
            <code style={{ flex:1, fontSize:'0.78rem', wordBreak:'break-all', color:'var(--text-main)' }}>{latestRawKey}</code>
            <button className="btn-icon" onClick={()=>copy(latestRawKey,'تم نسخ المفتاح')}><Copy size={15}/></button>
          </div>
        </div>
      )}

      {/* ── KPI Row ────────────────────────────────── */}
      <section style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem' }}>
        <KpiCard icon={<Wifi size={16}/>} label="حالة الاتصال"
          value={si.text} sub={sess?.phoneNumber||undefined}
          color={sess?.status==='ready'?'#16a34a':sess?.status==='qr_ready'?'#f59e0b':'#ef4444'} />
        <KpiCard icon={<MessageSquare size={16}/>} label="محادثات مفتوحة"
          value={summary?.openConversations ?? '—'} sub={`من ${summary?.totalConversations??0} خلال 90 يوم`}
          color="#0ea5e9" trend="up"/>
        <KpiCard icon={<CheckCircle2 size={16}/>} label="نسبة الإغلاق"
          value={`${resolutionRate}%`} sub={`${summary?.closedConversations??0} محادثة مغلقة`}
          color="#10b981" trend={resolutionRate>60?'up':resolutionRate>30?'flat':'down'}/>
        <KpiCard icon={<Clock size={16}/>} label="متوسط الرد"
          value={summary?.averageFirstResponseTime != null ? `${summary.averageFirstResponseTime} د` : '—'}
          sub="وقت أول رد" color="#f59e0b"/>
        <KpiCard icon={<TrendingUp size={16}/>} label="الحصة الشهرية"
          value={quota.toLocaleString('ar-SA')} sub="رسالة OTP / شهر" color="#064E3B"/>
        <KpiCard icon={<Users size={16}/>} label="أعضاء الفريق"
          value={agents.length} sub={`${activeKeys.length} مفاتيح API نشطة`} color="#10B981"/>
      </section>

      {/* ── Main Grid ──────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:'1.5rem' }}>

        {/* LEFT */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

          {/* Agent leaderboard */}
          <article style={{ background:'var(--bg-card)', border:'1px solid var(--border-soft)', borderRadius:'20px', padding:'1.5rem', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h2 style={{ fontSize:'1rem', fontWeight:800, display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Award size={18} color="#f59e0b"/> أداء الفريق — آخر 30 يوم
              </h2>
              <button onClick={()=>navigate('/support/reports')} style={{ fontSize:'0.75rem', color:'var(--brand-primary)', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>
                عرض التفصيلي ←
              </button>
            </div>

            {agents.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)', fontSize:'0.85rem' }}>
                لا توجد بيانات بعد لآخر 30 يوم
              </div>
            ) : (
              <>
                {/* Chart */}
                {agentsChartData.length > 0 && (
                  <div style={{ marginBottom:'1.25rem' }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={agentsChartData} barSize={14} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false}/>
                        <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text-muted)' }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fontSize:10, fill:'var(--text-muted)' }} axisLine={false} tickLine={false} width={30}/>
                        <Tooltip contentStyle={{ background:'var(--bg-card)', border:'1px solid var(--border-soft)', borderRadius:10, fontSize:12 }}/>
                        <Bar dataKey="محادثات" fill="#064E3B" radius={[6,6,0,0]}/>
                        <Bar dataKey="رسائل" fill="#0ea5e9" radius={[6,6,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', gap:'1.5rem', justifyContent:'center', marginTop:'0.4rem' }}>
                      {[['#064E3B','محادثات مغلقة'],['#0ea5e9','رسائل مرسلة']].map(([c,l])=>(
                        <span key={l} style={{ fontSize:'0.72rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px' }}>
                          <span style={{ width:10, height:10, borderRadius:3, background:c, display:'inline-block' }}/> {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* List */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                  {agents.slice(0,5).map((a,i) => <AgentRow key={a.employeeId} agent={a} rank={i}/>)}
                </div>
              </>
            )}
          </article>

          {/* Conversations breakdown */}
          <article style={{ background:'var(--bg-card)', border:'1px solid var(--border-soft)', borderRadius:'20px', padding:'1.5rem', boxShadow:'var(--shadow-sm)' }}>
            <h2 style={{ fontSize:'1rem', fontWeight:800, marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Activity size={18} color="#0ea5e9"/> توزيع المحادثات
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', alignItems:'center' }}>
              {/* Donut-like bars */}
              <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                {[
                  { label:'مفتوحة',  value: summary?.openConversations??0, color:'#064E3B' },
                  { label:'معلقة',   value: summary?.pendingConversations??0, color:'#f59e0b' },
                  { label:'مغلقة',   value: summary?.closedConversations??0, color:'#10b981' },
                ].map(row => {
                  const pct = summary?.totalConversations ? Math.round(row.value/summary.totalConversations*100) : 0;
                  return (
                    <div key={row.label}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:'0.8rem', fontWeight:600 }}>{row.label}</span>
                        <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{row.value} ({pct}%)</span>
                      </div>
                      <div style={{ height:8, borderRadius:99, background:'var(--bg-main)' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:row.color, borderRadius:99, transition:'width 0.8s ease' }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Total big number */}
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:'3.5rem', fontWeight:900, letterSpacing:'-0.04em', color:'var(--text-main)', lineHeight:1 }}>
                  {summary?.totalConversations ?? 0}
                </p>
                <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.25rem' }}>محادثة خلال 90 يوم</p>
                <div style={{ marginTop:'1rem', display:'flex', justifyContent:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                  <span style={{ background:'#dcfce7', color:'#166534', padding:'0.25rem 0.75rem', borderRadius:99, fontSize:'0.72rem', fontWeight:700 }}>
                    {resolutionRate}% معدل إغلاق
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

          {/* WhatsApp Card */}
          <article style={{ background:'var(--bg-card)', border:'1px solid var(--border-soft)', borderRadius:'20px', padding:'1.25rem', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ fontSize:'0.95rem', fontWeight:800, display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Smartphone size={17} color="var(--brand-primary)"/> واتساب
              </h2>
              <span style={{ padding:'0.28rem 0.75rem', borderRadius:99, fontSize:'0.72rem', fontWeight:700,
                background:si.bg, color:si.color, display:'flex', alignItems:'center', gap:'4px' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:si.dot, display:'inline-block' }}/>
                {si.text}
              </span>
            </div>

            {/* QR */}
            <div style={{ height:160, background:'var(--bg-main)', border:'1.5px dashed var(--border-medium)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1rem' }}>
              {sess?.qrDataUrl
                ? <img src={sess.qrDataUrl} alt="QR" style={{ width:140, height:140, objectFit:'contain' }}/>
                : <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
                    <QrCode size={40} style={{ marginBottom:'0.4rem' }}/>
                    <p style={{ fontSize:'0.75rem' }}>اضغط "بدء جلسة"</p>
                  </div>
              }
            </div>

            {sess?.phoneNumber && (
              <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'0.85rem', textAlign:'center' }}>
                📱 <strong>{sess.phoneNumber}</strong>
              </p>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              <button className="btn-primary" style={{ width:'100%' }} onClick={startQr} disabled={!!busy}>
                <QrCode size={15}/> {busy==='start'?'جاري البدء...':'بدء جلسة QR'}
              </button>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="btn-secondary" style={{ flex:1, fontSize:'0.78rem' }} onClick={refreshSession} disabled={!!busy}>
                  <RefreshCw size={14}/> تحديث
                </button>
                {sess?.status === 'ready' && (
                  <button className="btn-ghost" style={{ flex:1, fontSize:'0.78rem' }} onClick={disconnect} disabled={!!busy}>
                    <WifiOff size={14}/> قطع
                  </button>
                )}
              </div>
            </div>
          </article>

          {/* Quick nav */}
          <article style={{ background:'var(--bg-card)', border:'1px solid var(--border-soft)', borderRadius:'20px', padding:'1.25rem', boxShadow:'var(--shadow-sm)' }}>
            <h2 style={{ fontSize:'0.95rem', fontWeight:800, marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Zap size={17} color="var(--brand-primary)"/> وصول سريع
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              {[
                { icon:<MessageSquare size={18}/>, label:'صندوق الدعم', path:'/support/inbox', color:'#0ea5e9' },
                { icon:<Users size={18}/>, label:'فريق الدعم', path:'/support/employees', color:'#10B981' },
                { icon:<Send size={18}/>, label:'سجل OTP', path:'/otp-logs', color:'#10b981' },
                { icon:<Activity size={18}/>, label:'التقارير', path:'/support/reports', color:'#f59e0b' },
              ].map(item => (
                <button key={item.path} onClick={()=>navigate(item.path)} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:'0.4rem', padding:'0.85rem 0.5rem', borderRadius:'14px',
                  border:'1px solid var(--border-soft)', background:'var(--bg-main)',
                  cursor:'pointer', transition:'all 0.15s', color:'var(--text-main)',
                  fontSize:'0.78rem', fontWeight:600,
                }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=item.color; e.currentTarget.style.background=`${item.color}10`; e.currentTarget.style.color=item.color; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border-soft)'; e.currentTarget.style.background='var(--bg-main)'; e.currentTarget.style.color='var(--text-main)'; }}>
                  <span style={{ color:item.color }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </article>

          {/* API Keys */}

        </div>
      </div>

    </motion.div>
  );
}
