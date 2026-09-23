import { FormEvent, useEffect, useState, useRef } from 'react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Briefcase, MessageSquare, Send, History as HistoryIcon,
  Phone, RefreshCw, FileText, Tag, UserPlus, ChevronDown, Inbox,
  CheckCircle, Clock,
} from 'lucide-react';

const stages = ['new', 'contacted', 'interview', 'offer', 'accepted', 'rejected'];
const stageLabels: Record<string, string> = {
  new: 'مرشح جديد', contacted: 'تم التواصل', interview: 'مقابلة',
  offer: 'عرض عمل', accepted: 'تم القبول', rejected: 'مرفوض',
};
const stageColors: Record<string, { color: string; bg: string }> = {
  new:       { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  contacted: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  interview: { color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  offer:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  accepted:  { color: '#059669', bg: 'rgba(5,150,105,0.1)'   },
  rejected:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

function StageBadge({ stage }: { stage: string }) {
  const s = stageColors[stage] || stageColors.new;
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.65rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {stageLabels[stage] || stage}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name?.split(' ').slice(0, 2).map((w: string) => w[0]).join('') || '?';
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export function HrInboxPage() {
  const { token } = useAuth();
  const [tenantId] = useState('');
  const [applications, setApplications] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!token) return;
    setBusy(true);
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    try {
      const [inbox, temps, emps] = await Promise.all([
        apiRequest<any[]>(`/hr/inbox${q}`, {}, token),
        apiRequest<any[]>(`/hr/message-templates${q}`, {}, token),
        apiRequest<any[]>(`/hr/employees${q}`, {}, token).catch(() => []),
      ]);
      setApplications(inbox);
      setTemplates(temps);
      setEmployees(emps);
    } finally {
      setBusy(false);
    }
  }

  async function loadTimeline(app: any) {
    setSelected(app);
    setTimeline([]);
    const data = await apiRequest<any[]>(`/hr/applications/${app._id}/timeline`, {}, token);
    setTimeline(data);
    setTimeout(() => timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' }), 60);
  }

  async function moveStage(id: string, stage: string) {
    await apiRequest(`/hr/applications/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }, token);
    setSelected((prev: any) => prev?._id === id ? { ...prev, stage } : prev);
    load();
  }

  async function assign(id: string, assignedToUserId: string) {
    await apiRequest(`/hr/applications/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedToUserId }) }, token);
    load();
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selected || sending) return;
    setSending(true);
    try {
      await apiRequest(`/hr/applications/${selected._id}/message`, {
        method: 'POST',
        body: JSON.stringify({ templateId: templateId || undefined, message: message || undefined }),
      }, token);
      setMessage('');
      setTemplateId('');
      loadTimeline(selected);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  const filtered = applications.filter(app => {
    const matchSearch = !search || app.candidate?.fullName?.toLowerCase().includes(search.toLowerCase()) || app.job?.title?.toLowerCase().includes(search.toLowerCase());
    const matchStage = !stageFilter || app.stage === stageFilter;
    return matchSearch && matchStage;
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', background: 'var(--bg-main)' }}>

      {/* ===== LEFT PANEL: Candidates List ===== */}
      <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>الصندوق الوارد</h2>
            <button onClick={load} style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--bg-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={14} style={{ animation: busy ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <Search size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              placeholder="البحث عن مرشح أو وظيفة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingRight: '2.25rem', background: 'var(--bg-main)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', width: '100%', padding: '0.5rem 2.25rem 0.5rem 0.75rem', fontSize: '0.82rem', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Stage filter pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button onClick={() => setStageFilter('')} style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: !stageFilter ? 'var(--brand-primary)' : 'var(--bg-main)', color: !stageFilter ? '#fff' : 'var(--text-muted)' }}>الكل</button>
            {stages.map(s => (
              <button key={s} onClick={() => setStageFilter(s === stageFilter ? '' : s)} style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: stageFilter === s ? stageColors[s].bg : 'var(--bg-main)', color: stageFilter === s ? stageColors[s].color : 'var(--text-muted)' }}>
                {stageLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <Inbox size={32} strokeWidth={1} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>لا توجد نتائج</p>
            </div>
          ) : filtered.map(app => (
            <div
              key={app._id}
              onClick={() => loadTimeline(app)}
              style={{
                padding: '0.9rem 1.25rem',
                borderBottom: '1px solid var(--border-soft)',
                cursor: 'pointer',
                background: selected?._id === app._id ? 'var(--brand-primary-soft)' : 'transparent',
                borderRight: selected?._id === app._id ? '3px solid var(--brand-primary)' : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <Avatar name={app.candidate?.fullName || '?'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.candidate?.fullName}</span>
                    <StageBadge stage={app.stage} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    <Briefcase size={11} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.job?.title}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== CENTER: Timeline ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Avatar name={selected.candidate?.fullName || '?'} />
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{selected.candidate?.fullName}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {selected.job?.title} &bull; قدم في {new Date(selected.createdAt).toLocaleDateString('ar-SA')}
                  </p>
                </div>
              </div>
              <StageBadge stage={selected.stage} />
            </div>

            {/* Timeline */}
            <div ref={timelineRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {timeline.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  <Clock size={36} strokeWidth={1} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.9rem' }}>لا توجد أحداث بعد</p>
                </div>
              )}
              {timeline.map((event, i) => (
                <motion.div key={event._id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-primary)', marginTop: 4, flexShrink: 0 }} />
                    {i < timeline.length - 1 && <div style={{ flex: 1, width: 2, background: 'var(--border-soft)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{event.title}</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(event.createdAt).toLocaleString('ar-SA')}</span>
                    </div>
                    {event.body && (
                      <div style={{ padding: '0.875rem 1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {event.body}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Message Footer */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border-soft)', flexShrink: 0 }}>
              <form onSubmit={sendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.82rem', outline: 'none' }}
                >
                  <option value="">✏️ رسالة مخصصة</option>
                  {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, background: 'var(--bg-main)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
                    <textarea
                      placeholder="اكتب رسالة واتساب للمرشح..."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem 1rem', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '0.875rem', resize: 'none', outline: 'none', minHeight: 64, boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    type="submit"
                    onClick={e => { if (sending || (!message.trim() && !templateId)) e.preventDefault(); }}
                    style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (sending || (!message.trim() && !templateId)) ? 0.4 : 1, flexShrink: 0 }}
                  >
                    <Send size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '1rem' }}>
            <MessageSquare size={64} strokeWidth={1} style={{ opacity: 0.2 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>اختر مرشحاً</h3>
            <p style={{ fontSize: '0.875rem', textAlign: 'center', maxWidth: 280 }}>اضغط على أي مرشح من القائمة لعرض جدوله الزمني واتخاذ إجراءات.</p>
          </div>
        )}
      </div>

      {/* ===== RIGHT PANEL: Candidate Profile ===== */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border-soft)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>
            {/* Profile Hero */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem' }}>
                {(selected.candidate?.fullName || '?').split(' ').slice(0, 2).map((w: string) => w[0]).join('')}
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{selected.candidate?.fullName}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{selected.job?.title}</p>
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>تفاصيل التواصل</p>
              {selected.candidate?.phoneNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <Phone size={15} color="var(--brand-primary)" />
                  <span dir="ltr">{selected.candidate.phoneNumber}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <FileText size={15} color="var(--brand-primary)" />
                <span>السيرة الذاتية مرفقة</span>
              </div>
            </div>

            {/* Stage Control */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>المرحلة الحالية</p>
              <select
                value={selected.stage}
                onChange={e => moveStage(selected._id, e.target.value)}
                style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem', outline: 'none', width: '100%' }}
              >
                {stages.map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
              </select>
            </div>

            {/* Assign */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>تعيين مسؤول</p>
              <select
                value={selected.assignedToUserId || ''}
                onChange={e => assign(selected._id, e.target.value)}
                style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.875rem', outline: 'none', width: '100%' }}
              >
                <option value="">غير معين</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
            <Users size={36} strokeWidth={1} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.85rem' }}>سيظهر ملف المرشح هنا</p>
          </div>
        )}
      </div>
    </div>
  );
}
