import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, API_BASE_URL } from '../lib/api';
import { createSupportSocket } from '../lib/support-socket';
import { can, canCreateRoutingLink, Permission } from '../lib/permissions';
import { haptic, useIsMobile, useKeyboardInset } from '../lib/mobile';
import { MascotEmptyState, MascotFaceAvatar } from '../components/Mascot';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Send, User, CheckCircle2, UserPlus, MessageSquare,
  RefreshCw, Phone, AlertCircle, Zap, Sparkles, Loader2,
  Check, CheckCheck, Clock, StickyNote, ChevronDown, Tag,
  X, Circle, Filter, Inbox, Star, UserCheck, Paperclip, Image, FileText, Link2,
  ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Conversation {
  _id: string;
  customerName: string;
  customName?: string | null;
  /** Server-computed: customName → WhatsApp name. */
  displayName?: string | null;
  customerPhone: string;
  /** Server-computed: a dialable number, or null when WhatsApp only exposed an internal id. */
  phoneNumber?: string | null;
  aiState?: 'disabled' | 'active' | 'paused' | 'processing' | 'failed' | 'human_takeover';
  aiLastError?: string | null;
  whatsappChatId?: string;
  profilePicture?: string | null;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'normal' | 'high';
  assignedTo?: { id: string; name: string } | null;
  lastMessage: string;
  lastMessageAt?: string | null;
  unreadCount: number;
  tags?: Array<{ _id: string; name: string; color: string }>;
}

interface Message {
  _id: string;
  direction: 'incoming' | 'outgoing';
  body: string;
  createdAt: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sentByUserNameSnapshot?: string | null;
  sentByUserId?: string | null;
  messageType?: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  clientMessageId?: string | null;
  isEdited?: boolean;
  editedAt?: string | null;
}

type TimelineItem =
  | { _type: 'message'; _id: string; createdAt: string; item: Message }
  | { _type: 'note'; _id: string; createdAt: string; item: any };

interface MediaPreview {
  base64: string;
  mimetype: string;
  filename: string;
  objectUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Contact avatars: distinct, readable hues that complement the emerald identity.
const AVATAR_COLORS = [
  '#064E3B', '#0E7490', '#B45309', '#9333EA', '#BE123C',
  '#1D4ED8', '#C2410C', '#0F766E', '#7C2D12', '#4338CA',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function relativeTime(dateStr?: string | null) {
  if (!dateStr) return '';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins}د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}ي`;
  return new Date(dateStr).toLocaleDateString('ar-SY', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a); const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(dateStr, today.toISOString())) return 'اليوم';
  if (isSameDay(dateStr, yesterday.toISOString())) return 'أمس';
  return date.toLocaleDateString('ar-SY', { weekday: 'long', month: 'long', day: 'numeric' });
}

function newClientMessageId() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Adds or updates one message by id. A server message carrying the clientMessageId of an
 * optimistic entry replaces that entry, so the API response, the socket event and the
 * safety-net poll can all deliver the same message without it ever showing twice.
 */
function upsertMessage(curr: Message[], msg: Message | null | undefined): Message[] {
  if (!msg?._id) return curr;
  const tempId = msg.clientMessageId ? `temp-${msg.clientMessageId}` : null;
  const idx = curr.findIndex((m) => m._id === msg._id || (tempId !== null && m._id === tempId));
  if (idx === -1) return [...curr, msg];
  const prev = curr[idx];
  const merged: Message = { ...prev, ...msg, mediaUrl: msg.mediaUrl || prev.mediaUrl };
  return curr
    .map((m, i) => (i === idx ? merged : m))
    .filter((m, i) => i === idx || m._id !== msg._id);
}

function upsertNote(curr: any[], note: any, tempId?: string): any[] {
  if (!note?._id) return curr;
  const without = curr.filter((n) => n._id !== note._id && n._id !== tempId);
  const tempIdx = tempId ? curr.findIndex((n) => n._id === tempId) : -1;
  if (tempIdx === -1) return [...without, note];
  const next = curr.filter((n) => n._id !== note._id);
  return next.map((n) => (n._id === tempId ? note : n));
}

function conversationName(conv: Pick<Conversation, 'displayName' | 'customName' | 'customerName' | 'customerPhone' | 'phoneNumber'>) {
  return conv.displayName || conv.customName || conv.customerName || (conv.phoneNumber ? formatPhone(conv.phoneNumber) : '') || 'عميل بدون اسم';
}

const AI_STATE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'AI نشط', color: '#047857', bg: '#d1fae5' },
  processing: { label: 'AI يكتب…', color: '#1d4ed8', bg: '#dbeafe' },
  paused: { label: 'AI متوقف', color: '#475569', bg: '#e2e8f0' },
  failed: { label: 'AI فشل', color: '#b91c1c', bg: '#fee2e2' },
  human_takeover: { label: 'موظف مستلم', color: '#92400e', bg: '#fef3c7' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function isPhoneString(s: string) {
  // Returns true if the string is essentially a phone number (no real letters)
  return /^[+\d\s\-()]+$/.test(s.trim());
}

function Avatar({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) {
  const color = avatarColor(name);
  const [imgError, setImgError] = useState(false);
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${color}33` }}
      />
    );
  }
  const isPhone = isPhoneString(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color + '22', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: isPhone ? size * 0.42 : size * 0.35,
      fontWeight: 700, flexShrink: 0,
      border: `2px solid ${color}33`,
    }}>
      {isPhone
        ? <User size={size * 0.44} strokeWidth={2} color={color} />
        : initials(name)}
    </div>
  );
}

function formatPhone(phone: string) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // WhatsApp internal LID / Business system IDs have > 13 digits — not real phone numbers
  if (digits.length > 13) return '';
  if (digits.length >= 10) {
    // Syrian mobile: 963 + 9 digits → +963 9XX XXX XXX
    if (digits.startsWith('963') && digits.length === 12) {
      return `+963 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
    }
    // Polish/generic: group sensibly
    return '+' + digits;
  }
  return '+' + digits;
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    open: { bg: '#d1fae5', color: '#065f46', label: 'مفتوح' },
    pending: { bg: '#fef3c7', color: '#92400e', label: 'معلق' },
    closed: { bg: '#f1f5f9', color: '#64748b', label: 'مغلق' },
  };
  const s = cfg[status] || cfg.open;
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function ImageLightbox({ url, filename, onClose }: { url: string; filename: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <button onClick={onClose} style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
        <X size={20} />
      </button>
      <img
        src={url}
        alt={filename}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
      />
    </div>
  );
}

function MediaBubble({ msg, isOut }: { msg: Message; isOut: boolean }) {
  const [lightbox, setLightbox] = useState(false);
  const mime = msg.mediaMimeType || '';
  const rawUrl = msg.mediaUrl || '';
  const url = rawUrl.startsWith('/') ? `${API_BASE_URL}${rawUrl}` : rawUrl;
  const filename = msg.mediaFileName || 'ملف';
  const isImage = mime.startsWith('image/') || msg.messageType === 'image';

  if (isImage && url) {
    return (
      <>
        <img
          src={url}
          alt={filename}
          className="msg-media-img"
          onClick={() => setLightbox(true)}
          style={{ cursor: 'zoom-in' }}
        />
        {lightbox && <ImageLightbox url={url} filename={filename} onClose={() => setLightbox(false)} />}
      </>
    );
  }

  if (isImage && !url) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: isOut ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
        borderRadius: '10px', fontSize: '0.8rem',
      }}>
        <Image size={18} />
        <span>{filename || 'صورة مرسلة'}</span>
      </div>
    );
  }

  return (
    <div className="msg-media-doc" onClick={() => url && window.open(url, '_blank')}>
      <FileText size={18} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{filename}</span>
    </div>
  );
}

function MsgStatus({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck size={14} color="#60a5fa" />;
  if (status === 'delivered') return <CheckCheck size={14} color="rgba(255,255,255,0.7)" />;
  if (status === 'sent') return <Check size={14} color="rgba(255,255,255,0.7)" />;
  if (status === 'failed') return <X size={14} color="#fca5a5" />;
  return <Clock size={14} color="rgba(255,255,255,0.5)" />;
}

function ConvItem({
  conv, selected, onClick, roleTag,
}: { conv: Conversation; selected: boolean; onClick: () => void; roleTag?: { label: string; name: string } | null }) {
  const formattedPhone = conv.phoneNumber ? formatPhone(conv.phoneNumber) : formatPhone(conv.customerPhone);
  const name = conversationName(conv);
  // Only show phone as sub-line if there's a real name AND a dialable number
  const displaySub = name !== formattedPhone && formattedPhone ? formattedPhone : null;
  const priorityColor = conv.priority === 'high' ? '#ef4444' : conv.priority === 'low' ? '#94a3b8' : 'transparent';
  return (
    <div
      onClick={onClick}
      className="conv-item press"
      style={{
        display: 'flex', gap: '0.75rem', padding: '0.9rem 1rem',
        borderBottom: '1px solid var(--border-soft)',
        cursor: 'pointer',
        background: selected ? 'var(--brand-primary-soft)' : 'transparent',
        borderRight: `3px solid ${selected ? 'var(--brand-primary)' : 'transparent'}`,
        transition: 'all 120ms',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-main)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {conv.priority === 'high' && (
        <div style={{ position: 'absolute', top: 8, left: 8, width: 6, height: 6, borderRadius: '50%', background: priorityColor }} />
      )}
      <Avatar name={name} size={44} src={conv.profilePicture} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
          <div style={{ minWidth: 0, maxWidth: '140px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
              <span style={{ fontWeight: conv.unreadCount > 0 ? 700 : 600, fontSize: '0.88rem', color: selected ? 'var(--brand-primary)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              {roleTag && (
                <span
                  title={`${roleTag.label}: ${roleTag.name}`}
                  style={{
                    flexShrink: 0,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--brand-primary-soft)',
                    color: 'var(--brand-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '90px',
                  }}
                >
                  {roleTag.label}: {roleTag.name}
                </span>
              )}
            </div>
            {displaySub && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                {displaySub}
              </div>
            )}
          </div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            {relativeTime(conv.lastMessageAt)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>
            {conv.lastMessage || 'لا توجد رسائل'}
          </p>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
            {conv.unreadCount > 0 && (
              <span style={{ background: 'var(--brand-primary)', color: '#fff', borderRadius: '999px', minWidth: '20px', height: '20px', padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
              </span>
            )}
            <StatusPill status={conv.status} />
          </div>
        </div>
        {conv.assignedTo && (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <UserCheck size={10} /> {conv.assignedTo.name}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Notification Sound ───────────────────────────────────────────────────────

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Two-tone pleasant notification
    const times = [
      { freq: 880, start: 0,    duration: 0.12 },
      { freq: 1100, start: 0.13, duration: 0.15 },
    ];
    times.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.01);
    });
  } catch { /* audio not available */ }
}

// ─── Module-level cache ───────────────────────────────────────────────────────
// Persists across navigations AND full reloads (localStorage) so the list shows
// instantly on revisit — fresh data then loads in the background (stale-while-revalidate).
const CONV_CACHE_LS_KEY = 'vayro-conv-cache-v1';

function loadConvCacheFromStorage(): { data: Conversation[]; key: string } {
  try {
    const raw = localStorage.getItem(CONV_CACHE_LS_KEY);
    if (!raw) return { data: [], key: '' };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.data)) return { data: parsed.data, key: parsed.key || '' };
  } catch {
    // ignore corrupt/unavailable storage
  }
  return { data: [], key: '' };
}

const _initialConvCache = loadConvCacheFromStorage();
let _convCache: Conversation[] = _initialConvCache.data;
let _convCacheKey = _initialConvCache.key;

function persistConvCache(data: Conversation[], key: string) {
  _convCache = data;
  _convCacheKey = key;
  try {
    // Cap what we store so localStorage stays small and fast.
    localStorage.setItem(CONV_CACHE_LS_KEY, JSON.stringify({ data: data.slice(0, 60), key }));
  } catch {
    // ignore quota / private-mode errors
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SupportInboxPage() {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(_convCache);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'assigned_to_me' | 'unassigned'>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'pending' | 'closed' | ''>('open');
  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(_convCache.length === 0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rightTab, setRightTab] = useState<'info' | 'notes' | 'ai'>('info');
  // On mobile the 3 panes collapse to one: 'list' shows the conversation list,
  // 'thread' shows the open chat with a back button. Ignored on desktop (CSS).
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  // An open chat takes the whole phone screen — the app's top bar and tab bar hide (CSS).
  useEffect(() => {
    document.body.classList.toggle('chat-open', mobileView === 'thread');
    return () => document.body.classList.remove('chat-open');
  }, [mobileView]);
  const [slashMenu, setSlashMenu] = useState({ visible: false, filter: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [inputMode, setInputMode] = useState<'message' | 'note'>('message');
  const [doctorRelayTags, setDoctorRelayTags] = useState<Record<string, { label: string; name: string }>>({});
  const [doctorRelayEnabled, setDoctorRelayEnabled] = useState(false);
  const [doctorRelaySettings, setDoctorRelaySettings] = useState({ professionalLabel: 'الطبيب', clientLabel: 'المريض' });
  const [linkModalRole, setLinkModalRole] = useState<'professional' | 'client'>('professional');
  const [linkModalTargetId, setLinkModalTargetId] = useState('');
  const [linkModalSearch, setLinkModalSearch] = useState('');
  const [linkModalSubmitting, setLinkModalSubmitting] = useState(false);
  const [linkModalError, setLinkModalError] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  // typing: map of userId → { name, timer }
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Stable refs so socket handler always sees latest values without reconnecting
  const selectedIdRef = useRef<string | null>(null);
  const loadConversationsRef = useRef<() => void>(() => {});
  const setMessagesRef = useRef(setMessages);
  const setNotesRef = useRef(setNotes);
  const setMobileViewRef = useRef(setMobileView);
  const tokenRef = useRef<string | null>(null);
  const messagesDataRef = useRef<Message[]>([]);
  // Realtime health: while the socket is delivering we barely need to poll. Each HTTP
  // round-trip costs ~450ms through the tunnel, so polling hard is what made the UI
  // feel sluggish — the socket is a single persistent connection with no such cost.
  const socketHealthyRef = useRef(false);
  const pollTickRef = useRef(0);
  // Increments on every optimistic update — background fetches only apply if this hasn't changed
  const optimisticVersionRef = useRef(0);
  // Socket ref — stable across renders
  const socketRef = useRef<ReturnType<typeof createSupportSocket> | null>(null);
  // Typing stop debounce timer
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canAssign = can(user, Permission.CONVERSATIONS_ASSIGN);
  const canClaim = can(user, Permission.CONVERSATIONS_CLAIM);
  const canEditContact = can(user, Permission.CONTACTS_EDIT);
  const canManageAi = can(user, Permission.AI_MANAGE);
  const canLinkConversations = canCreateRoutingLink(user);
  // Guards against a second send before React re-renders `sending` (fast double Enter/click).
  const sendingRef = useRef(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [inboxNotice, setInboxNotice] = useState<string | null>(null);
  const isMobile = useIsMobile();
  // Keeps the composer sitting on the keyboard instead of hiding under it.
  useKeyboardInset(isMobile);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelowCount, setNewBelowCount] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartRef = useRef<number | null>(null);
  const atBottomRef = useRef(true);
  // Someone else is currently typing in this conversation
  const someoneElseTyping = Object.keys(typingUsers).length > 0;

  // Tracks whether next scroll should animate (new msg) or be instant (open conv)
  const scrollBehaviorRef = useRef<'instant' | 'smooth'>('instant');

  // Scroll to bottom when messages load or conversation changes — before browser paint to
  // avoid a visible jump. While the user is reading older messages we leave the scroll
  // alone and show a "jump to latest" button instead, like a native chat app.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setNewBelowCount((n) => n + 1);
    }
  }, [messages, selected?._id]);

  // Track whether the view is pinned to the newest message.
  const handleChatScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distanceFromBottom < 80;
    atBottomRef.current = pinned;
    setAtBottom(pinned);
    if (pinned) setNewBelowCount(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    atBottomRef.current = true;
    setNewBelowCount(0);
  }, []);

  // Pull down on the conversation list to refresh, the way a native app does.
  const onListTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const el = e.currentTarget;
    pullStartRef.current = el.scrollTop <= 0 ? e.touches[0].clientY : null;
  };
  const onListTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartRef.current === null || refreshing) return;
    const delta = e.touches[0].clientY - pullStartRef.current;
    if (delta > 0) setPullDistance(Math.min(delta * 0.5, 72));
  };
  const onListTouchEnd = async () => {
    if (pullStartRef.current === null) return;
    const shouldRefresh = pullDistance > 48;
    pullStartRef.current = null;
    if (!shouldRefresh) { setPullDistance(0); return; }
    haptic(12);
    setRefreshing(true);
    setPullDistance(40);
    try {
      await loadConversations();
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  };

  const scrollToBottom = useCallback((_behavior?: ScrollBehavior) => {
    // useLayoutEffect handles it; this is kept for socket new-message smooth nudge
    setTimeout(() => {
      if (scrollRef.current && atBottomRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (ownerFilter !== 'all') p.set('filter', ownerFilter);
    if (statusFilter) p.set('status', statusFilter);
    const cacheKey = `${token}|${search}|${ownerFilter}|${statusFilter}`;
    const data = await apiRequest<Conversation[]>(`/api/conversations?${p}`, {}, token);
    persistConvCache(data, cacheKey);
    setConversations(data);
    setLoading(false);
  }, [token, search, ownerFilter, statusFilter]);

  const loadMeta = useCallback(() => {
    if (!token) return;
    apiRequest<any[]>('/api/quick-replies', {}, token).then(setQuickReplies);
    if (canAssign) apiRequest<any[]>('/api/employees', {}, token).then(setEmployees);
  }, [token, canAssign]);

  const loadMessages = useCallback(async (id: string) => {
    if (!token) return;
    setMessagesLoading(true);
    try {
      const [msgs, nts] = await Promise.all([
        apiRequest<Message[]>(`/api/conversations/${id}/messages`, {}, token),
        apiRequest<any[]>(`/api/conversations/${id}/notes`, {}, token),
      ]);
      setMessages(msgs);
      setNotes(nts);
      setAiSuggestions([]);
      setAiSummary('');
      // mark read fire-and-forget
      apiRequest(`/api/conversations/${id}/read`, { method: 'POST' }, token).catch(() => {});
    } catch {
      setMessages([]);
      setNotes([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [token]);

  const selectConversation = useCallback(async (conv: Conversation) => {
    setSelected(conv);
    setEditingName(false);
    const versionAtClick = optimisticVersionRef.current;
    await loadMessages(conv._id);
    // refresh conv details in background for fresh status — but only if no optimistic update happened since
    if (token) {
      apiRequest<Conversation>(`/api/conversations/${conv._id}`, {}, token)
        .then(fresh => {
          if (optimisticVersionRef.current === versionAtClick) {
            setSelected(fresh);
          }
        })
        .catch(() => {});
    }
  }, [token, loadMessages]);

  const loadDetails = useCallback(async (id: string) => {
    if (!token) return;
    try {
      const [conv, msgs, nts] = await Promise.all([
        apiRequest<Conversation>(`/api/conversations/${id}`, {}, token),
        apiRequest<Message[]>(`/api/conversations/${id}/messages`, {}, token),
        apiRequest<any[]>(`/api/conversations/${id}/notes`, {}, token),
      ]);
      setSelected(conv);
      setMessages(msgs);
      setNotes(nts);
      apiRequest(`/api/conversations/${id}/read`, { method: 'POST' }, token).catch(() => {});
    } catch {
      // ignore refresh errors
    }
  }, [token]);

  useEffect(() => {
    const cacheKey = `${token}|${search}|${ownerFilter}|${statusFilter}`;
    if (_convCacheKey !== cacheKey) setLoading(true);
    loadConversations();
  }, [loadConversations]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  // If this tenant also has the doctor-relay product, load links + labels so the
  // conversation list can show a small role badge (e.g. "الطبيب: محمد") per contact,
  // and so the "link to another conversation" action has what it needs.
  const hasDoctorRelay = user?.role === 'super_admin' || (user?.enabledProducts || []).includes('doctor_relay');

  const reloadDoctorRelay = useCallback(async () => {
    if (!token || !hasDoctorRelay) return;
    try {
      const [links, settings] = await Promise.all([
        apiRequest<Array<{ doctorPhone: string; doctorName: string; patientPhone: string; patientName: string; status: string }>>(
          '/api/doctor-relay/links', {}, token,
        ),
        apiRequest<{ professionalLabel: string; clientLabel: string }>('/api/doctor-relay/settings', {}, token),
      ]);
      const map: Record<string, { label: string; name: string }> = {};
      for (const link of links) {
        if (link.status !== 'active') continue;
        map[link.doctorPhone.replace(/\D/g, '')] = { label: settings.professionalLabel, name: link.doctorName };
        map[link.patientPhone.replace(/\D/g, '')] = { label: settings.clientLabel, name: link.patientName };
      }
      setDoctorRelayTags(map);
      setDoctorRelaySettings(settings);
      setDoctorRelayEnabled(true);
    } catch {
      // Feature not enabled for this tenant or request failed — badges simply don't show.
      setDoctorRelayEnabled(false);
    }
  }, [token, hasDoctorRelay]);

  useEffect(() => { reloadDoctorRelay(); }, [reloadDoctorRelay]);

  async function submitLinkModal() {
    if (!token || !selected || !linkModalTargetId) return;
    const target = conversations.find((c) => c._id === linkModalTargetId);
    if (!target) return;

    setLinkModalSubmitting(true);
    setLinkModalError(null);
    try {
      const professionalConv = linkModalRole === 'professional' ? selected : target;
      const clientConv = linkModalRole === 'professional' ? target : selected;

      // One call, using each conversation's own whatsappChatId — no WhatsApp round-trip.
      await apiRequest('/api/doctor-relay/link-conversations', {
        method: 'POST',
        body: JSON.stringify({
          professional: {
            name: conversationName(professionalConv),
            phone: professionalConv.customerPhone,
            chatId: professionalConv.whatsappChatId,
          },
          client: {
            name: conversationName(clientConv),
            phone: clientConv.customerPhone,
            chatId: clientConv.whatsappChatId,
          },
        }),
      }, token);

      setShowLinkModal(false);
      setLinkModalTargetId('');
      setLinkModalSearch('');
      reloadDoctorRelay();
    } catch (err) {
      setLinkModalError(err instanceof Error ? err.message : 'حدث خطأ أثناء الربط');
    } finally {
      setLinkModalSubmitting(false);
    }
  }

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Keep refs up to date so socket handler sees latest values without reconnecting
  useEffect(() => { selectedIdRef.current = selected?._id ?? null; }, [selected?._id]);
  useEffect(() => { loadConversationsRef.current = loadConversations; }, [loadConversations]);
  useEffect(() => { tokenRef.current = token ?? null; }, [token]);
  useEffect(() => { messagesDataRef.current = messages; }, [messages]);

  // Near-instant live updates for the OPEN conversation. Incremental: asks only for
  // messages newer than the last one we already have (tiny payload), so it can run
  // every second cheaply and stays reliable even if the websocket is dropped.
  const refreshOpenConversationSilent = useCallback(async () => {
    const id = selectedIdRef.current;
    const t = tokenRef.current;
    if (!id || !t) return;
    try {
      const persisted = messagesDataRef.current.filter((m) => !m._id.startsWith('temp-'));
      const lastCreatedAt = persisted.length ? persisted[persisted.length - 1].createdAt : null;
      const url = lastCreatedAt
        ? `/api/conversations/${id}/messages?after=${encodeURIComponent(lastCreatedAt)}`
        : `/api/conversations/${id}/messages`;
      const incoming = await apiRequest<Message[]>(url, {}, t);
      if (selectedIdRef.current !== id || incoming.length === 0) return;
      setMessagesRef.current((curr) => incoming.reduce(upsertMessage, curr));
      scrollToBottom();
    } catch {
      // ignore
    }
  }, [scrollToBottom]);

  // Poll the open conversation every 1s — feels instant, guaranteed regardless of the
  // socket, and paused while the tab is hidden. Payload is empty when nothing is new.
  useEffect(() => {
    if (!selected?._id) return;
    pollTickRef.current = 0;
    const interval = setInterval(() => {
      if (document.hidden) return;
      pollTickRef.current += 1;
      // Socket healthy → messages already arrive push-style; poll only every 10s as a
      // safety net. Socket down → poll every second so nothing is missed.
      const shouldPoll = socketHealthyRef.current ? pollTickRef.current % 10 === 0 : true;
      if (shouldPoll) refreshOpenConversationSilent();
    }, 1000);
    return () => clearInterval(interval);
  }, [selected?._id, refreshOpenConversationSilent]);

  // Backup poll for the conversation list — rare while the socket is healthy.
  useEffect(() => {
    if (!token) return;
    let tick = 0;
    const interval = setInterval(() => {
      if (document.hidden) return;
      tick += 1;
      const shouldPoll = socketHealthyRef.current ? tick % 6 === 0 : true;
      if (shouldPoll) loadConversationsRef.current();
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Join/leave conversation socket room and clear typing indicators on switch
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (selected?._id) {
      socket.emit('conversation:join', { conversationId: selected._id });
      setTypingUsers({});
    }
  }, [selected?._id]);

  // Realtime — only recreates when token changes
  useEffect(() => {
    if (!token) return;
    const socket = createSupportSocket(token);
    socketRef.current = socket;

    socket.on('message:new', (p: any) => {
      const currentSelectedId = selectedIdRef.current;
      if (p.conversationId === currentSelectedId && p.message) {
        // Every message (incoming, other agents', AI, our own) goes through one upsert keyed
        // by _id / clientMessageId, so the same message can never appear twice.
        setMessagesRef.current(curr => upsertMessage(curr, p.message));
        scrollToBottom();
      }
      if (p.message?.direction === 'incoming') {
        playNotificationSound();
        haptic([10, 40, 10]);
        if (document.hidden && Notification.permission === 'granted') {
          new Notification('رسالة جديدة', {
            body: p.message?.body || 'وصلت رسالة جديدة',
            icon: '/favicon.ico',
          });
        }
      }
      loadConversationsRef.current();
    });

    socket.on('message:status_updated', (p: any) => {
      setMessagesRef.current(curr =>
        curr.map(m => m._id === p.messageId ? { ...m, status: p.status } : m)
      );
    });

    socket.on('message:updated', (p: any) => {
      if (p.conversationId !== selectedIdRef.current) return;
      if (p.removedMessageId) {
        setMessagesRef.current(curr => curr.filter(m => m._id !== p.removedMessageId));
        return;
      }
      setMessagesRef.current(curr =>
        curr.some(m => m._id === p.message?._id) ? upsertMessage(curr, p.message) : curr,
      );
    });

    socket.on('note:new', (p: any) => {
      if (p.conversationId !== selectedIdRef.current || !p.note?._id) return;
      setNotesRef.current(curr => upsertNote(curr, p.note));
    });
    socket.on('note:deleted', (p: any) => {
      if (p.conversationId !== selectedIdRef.current) return;
      setNotesRef.current(curr => curr.filter(n => n._id !== p.noteId));
    });

    const refreshSelectedConversation = (conversationId: string, fresh?: Conversation) => {
      if (conversationId !== selectedIdRef.current) return;
      if (fresh) { setSelected(fresh); return; }
      const t = tokenRef.current;
      if (!t) return;
      apiRequest<Conversation>(`/api/conversations/${conversationId}`, {}, t)
        .then(setSelected)
        .catch(() => {
          // No longer visible to this user (e.g. reassigned to another agent).
          setSelected(null);
          setMessagesRef.current([]);
          setNotesRef.current([]);
          setMobileViewRef.current('list');
          setInboxNotice('تم تحويل هذه المحادثة لموظف آخر');
        });
    };

    socket.on('conversation:updated', (p: any) => {
      loadConversationsRef.current();
      if (p?.conversationId) refreshSelectedConversation(p.conversationId, p.conversation);
    });
    socket.on('conversation:status_changed', (p: any) => {
      loadConversationsRef.current();
      if (p?.conversationId) refreshSelectedConversation(p.conversationId, p.conversation);
    });
    // Sent to the whole company with ids only — every list refetches its own scoped view,
    // so the chat leaves the old assignee / unassigned tab and appears for the new one.
    socket.on('conversation:assigned', (p: any) => {
      loadConversationsRef.current();
      if (p?.conversationId) refreshSelectedConversation(p.conversationId);
    });
    socket.on('conversation:new', () => {
      loadConversationsRef.current();
      playNotificationSound();
    });

    socket.on('typing:start', (p: { conversationId: string; userId: string; userName: string }) => {
      if (p.conversationId !== selectedIdRef.current) return;
      setTypingUsers(prev => ({ ...prev, [p.userId]: p.userName }));
    });

    socket.on('typing:stop', (p: { conversationId: string; userId: string }) => {
      if (p.conversationId !== selectedIdRef.current) return;
      setTypingUsers(prev => { const n = { ...prev }; delete n[p.userId]; return n; });
    });

    // On (re)connect, resync so a drop never leaves stale data until manual refresh.
    socket.on('connect', () => {
      socketHealthyRef.current = true;
      loadConversationsRef.current();
      refreshOpenConversationSilent();
    });
    socket.io.on('reconnect', () => {
      socketHealthyRef.current = true;
      loadConversationsRef.current();
      refreshOpenConversationSilent();
    });
    socket.on('disconnect', () => {
      // Fall back to fast polling until the socket is back.
      socketHealthyRef.current = false;
    });
    socket.on('connect_error', (err: Error) => console.warn('[Socket] Error:', err.message));

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token]);

  // Combined timeline sorted by timestamp — notes appear at their creation time among messages
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const msgs: TimelineItem[] = messages.map(m => ({ _type: 'message', _id: m._id, createdAt: m.createdAt, item: m }));
    const nts: TimelineItem[] = notes.map(n => ({ _type: 'note', _id: n._id, createdAt: n.createdAt, item: n }));
    return [...msgs, ...nts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, notes]);

  // Group timeline by date
  const messageGroups = useMemo(() => {
    const groups: Array<{ date: string; items: TimelineItem[] }> = [];
    for (const item of timelineItems) {
      const last = groups[groups.length - 1];
      if (!last || !isSameDay(last.date, item.createdAt)) {
        groups.push({ date: item.createdAt, items: [item] });
      } else {
        last.items.push(item);
      }
    }
    return groups;
  }, [timelineItems]);

  const filteredReplies = quickReplies.filter(r =>
    r.title.toLowerCase().includes(slashMenu.filter.toLowerCase()) ||
    (r.category || '').toLowerCase().includes(slashMenu.filter.toLowerCase())
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);
    const lastSlash = val.lastIndexOf('/');
    if (lastSlash !== -1 && lastSlash === val.length - 1) {
      setSlashMenu({ visible: true, filter: '' });
    } else if (slashMenu.visible && val.includes('/')) {
      setSlashMenu({ ...slashMenu, filter: val.substring(lastSlash + 1) });
    } else if (slashMenu.visible) {
      setSlashMenu({ visible: false, filter: '' });
    }
    // Typing indicator — only in message mode for real conversations
    if (inputMode === 'message' && selected && socketRef.current) {
      const convId = selected._id;
      socketRef.current.emit('typing:start', { conversationId: convId });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('typing:stop', { conversationId: convId });
      }, 2500);
    }
  };

  /** Shared by the composer and the details panel: optimistic, then swapped for the saved note. */
  const saveNote = async (noteText: string) => {
    if (!token || !selected || !noteText.trim()) return false;
    const conversationId = selected._id;
    const tempId = `temp-note-${newClientMessageId()}`;
    const optimisticNote = { _id: tempId, note: noteText.trim(), createdAt: new Date().toISOString(), author: { name: user?.name ?? '' } };
    setNotes(curr => [...curr, optimisticNote]);
    try {
      const res = await apiRequest<any>(`/api/conversations/${conversationId}/notes`, {
        method: 'POST', body: JSON.stringify({ note: noteText.trim() }),
      }, token);
      if (selectedIdRef.current === conversationId) {
        // The socket copy may already be in the list — upsertNote keeps exactly one.
        setNotes(curr => upsertNote(curr, res, tempId));
      }
      return true;
    } catch (err) {
      setNotes(curr => curr.filter(n => n._id !== tempId));
      setInboxNotice(err instanceof Error ? `تعذر حفظ الملاحظة: ${err.message}` : 'تعذر حفظ الملاحظة');
      return false;
    }
  };

  const sendNote = async () => {
    if (!draft.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const noteText = draft.trim();
    setDraft('');
    try {
      await saveNote(noteText);
    } finally {
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (someoneElseTyping && inputMode === 'message') return;
      if (inputMode === 'note') { if (draft.trim()) sendNote(); }
      else if (draft.trim()) sendMessage();
    }
    if (e.key === 'Escape') setSlashMenu({ visible: false, filter: '' });
  };

  const insertReply = (text: string) => {
    const lastSlash = draft.lastIndexOf('/');
    setDraft((lastSlash !== -1 ? draft.substring(0, lastSlash) : '') + text);
    setSlashMenu({ visible: false, filter: '' });
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    if (!token || !selected || !draft.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const body = draft.trim();
    const conversationId = selected._id;
    setDraft('');
    // Stop typing indicator immediately on send
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socketRef.current?.emit('typing:stop', { conversationId });

    // Idempotency key: the server returns the same message for a repeated key and never
    // sends it to WhatsApp twice. The optimistic entry is keyed by it too.
    haptic();
    atBottomRef.current = true;
    const clientMessageId = newClientMessageId();
    const optimistic: Message = {
      _id: `temp-${clientMessageId}`,
      clientMessageId,
      direction: 'outgoing',
      body,
      createdAt: new Date().toISOString(),
      status: 'pending',
      messageType: 'text',
      sentByUserNameSnapshot: user?.name ?? null,
      sentByUserId: user?.id ?? null,
    };
    setMessages(curr => [...curr, optimistic]);

    try {
      const res = await apiRequest<{ message: Message; conversation: Conversation }>(
        `/api/conversations/${conversationId}/messages`,
        { method: 'POST', body: JSON.stringify({ body, clientMessageId }) },
        token,
      );
      if (selectedIdRef.current === conversationId) {
        setMessages(curr => upsertMessage(curr, res?.message ? { ...res.message, clientMessageId } : null));
      }
      loadConversationsRef.current();
    } catch (err: any) {
      console.error('[WA] sendMessage failed:', err?.message || err);
      setMessages(curr =>
        curr.map(m => m._id === optimistic._id ? { ...m, status: 'failed' as const } : m)
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const pickMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip data:...;base64, prefix
      const base64 = result.split(',')[1];
      setMediaPreview({ base64, mimetype: file.type, filename: file.name, objectUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const sendMedia = async () => {
    if (!token || !selected || !mediaPreview || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const caption = draft.trim();
    setDraft('');
    const preview = mediaPreview;
    setMediaPreview(null);

    // Optimistically show the image in the chat immediately using local blob URL
    const clientMessageId = newClientMessageId();
    const tempId = `temp-${clientMessageId}`;
    const optimistic: Message = {
      clientMessageId,
      _id: tempId,
      direction: 'outgoing',
      body: caption,
      createdAt: new Date().toISOString(),
      status: 'pending',
      messageType: preview.mimetype.startsWith('image/') ? 'image' : 'document',
      mediaUrl: preview.objectUrl,
      mediaMimeType: preview.mimetype,
      mediaFileName: preview.filename,
    };
    setMessages(curr => [...curr, optimistic]);

    try {
      const res = await apiRequest<{ message: Message }>(
        `/api/conversations/${selected._id}/messages/media`,
        { method: 'POST', body: JSON.stringify({ base64Data: preview.base64, mimetype: preview.mimetype, filename: preview.filename, caption, clientMessageId }) },
        token,
      );
      // Replace optimistic with real message; upsertMessage keeps the blob URL so the image stays visible
      setMessages(curr => upsertMessage(curr, res?.message ? { ...res.message, clientMessageId } : null));
      loadConversationsRef.current();

    } catch {
      // On error remove optimistic message
      setMessages(curr => curr.filter(m => m._id !== tempId));
      URL.revokeObjectURL(preview.objectUrl);
    } finally {
      sendingRef.current = false;
      setSending(false);
      // Revoke blob URL after 2 minutes (enough time for viewing)
      setTimeout(() => URL.revokeObjectURL(preview.objectUrl), 120000);
      inputRef.current?.focus();
    }
  };

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;
    setNoteDraft('');
    // Previously this waited for a full details reload; any failure there left the note
    // invisible until a page refresh. Now it shows immediately like the composer note.
    const ok = await saveNote(text);
    if (!ok) setNoteDraft(text);
  };

  const startEditName = () => {
    if (!selected) return;
    setNameDraft(selected.customName || selected.displayName || selected.customerName || '');
    setEditingName(true);
  };

  const saveContactName = async () => {
    if (!token || !selected) return;
    setNameSaving(true);
    try {
      const updated = await apiRequest<Conversation>(`/api/conversations/${selected._id}/contact`, {
        method: 'PATCH', body: JSON.stringify({ customName: nameDraft.trim() }),
      }, token);
      setSelected(updated);
      setConversations(prev => prev.map(c => c._id === updated._id ? { ...c, ...updated } : c));
      setEditingName(false);
    } catch (err) {
      setInboxNotice(err instanceof Error ? `تعذر حفظ الاسم: ${err.message}` : 'تعذر حفظ الاسم');
    } finally {
      setNameSaving(false);
    }
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(`+${phone}`);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1500);
    } catch {
      setInboxNotice('تعذر نسخ الرقم');
    }
  };

  const toggleConversationAi = async () => {
    if (!token || !selected) return;
    const next = selected.aiState === 'paused' || selected.aiState === 'human_takeover' || selected.aiState === 'failed'
      ? 'active' : 'paused';
    try {
      const updated = await apiRequest<Conversation>(`/api/conversations/${selected._id}/ai`, {
        method: 'PATCH', body: JSON.stringify({ status: next }),
      }, token);
      setSelected(updated);
    } catch (err) {
      setInboxNotice(err instanceof Error ? err.message : 'تعذر تغيير حالة الذكاء الاصطناعي');
    }
  };

  const assignConv = async (uid: string) => {
    if (!token || !selected) return;
    // Optimistic update
    optimisticVersionRef.current += 1;
    const emp = employees.find(e => (e._id || e.id) === uid);
    const optimistic: Conversation = {
      ...selected,
      assignedTo: uid ? { id: uid, name: emp?.name ?? '' } : null,
    };
    setSelected(optimistic);
    setConversations(prev => prev.map(c => c._id === selected._id ? optimistic : c));
    _convCache = _convCache.map(c => c._id === selected._id ? optimistic : c);
    // Background API call
    const path = uid
      ? `/api/conversations/${selected._id}/assign`
      : `/api/conversations/${selected._id}/unassign`;
    apiRequest<Conversation>(path, { method: 'POST', body: JSON.stringify({ assignedToUserId: uid }) }, token)
      .then((fresh) => { if (fresh?._id) setSelected(fresh); loadConversations(); })
      .catch((err) => {
        setSelected(selected);
        loadConversations();
        setInboxNotice(err instanceof Error ? `تعذر التعيين: ${err.message}` : 'تعذر التعيين');
      });
  };

  const setStatus = async (s: 'open' | 'pending' | 'closed') => {
    if (!token || !selected) return;
    // Optimistic update
    optimisticVersionRef.current += 1;
    const optimistic: Conversation = { ...selected, status: s };
    setSelected(optimistic);
    setConversations(prev => prev.map(c => c._id === selected._id ? optimistic : c));
    _convCache = _convCache.map(c => c._id === selected._id ? optimistic : c);
    // Background API call
    apiRequest(`/api/conversations/${selected._id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: s }),
    }, token)
      .then(() => loadConversations())
      .catch(() => { setSelected(selected); });
  };

  const claimConv = async () => {
    if (!token || !selected) return;
    try {
      await apiRequest(`/api/conversations/${selected._id}/claim`, { method: 'POST' }, token);
      await loadDetails(selected._id);
    } catch (err) {
      setInboxNotice(err instanceof Error ? err.message : 'تعذر استلام المحادثة');
    }
    loadConversations();
  };

  const handleAiAssist = async () => {
    if (!selected || !token) return;
    setAiLoading(true);
    setRightTab('ai');
    try {
      const result = await apiRequest<any>(`/api/conversations/${selected._id}/ai-assist`, { method: 'POST' }, token);
      setAiSuggestions(result.suggestions || []);
      setAiSummary(result.summary || '');
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Filter tabs ────────────────────────────────────────────────────────────

  const ownerTabs = [
    { key: 'all', label: 'الكل', icon: <Inbox size={13} /> },
    { key: 'assigned_to_me', label: 'لي', icon: <Star size={13} /> },
    { key: 'unassigned', label: 'غير معين', icon: <User size={13} /> },
  ] as const;

  const statusTabs = [
    { key: '', label: 'الكل' },
    { key: 'open', label: 'مفتوح' },
    { key: 'pending', label: 'معلق' },
    { key: 'closed', label: 'مغلق' },
  ] as const;

  return (
    <div className="inbox-container" data-mv={mobileView} dir="rtl" style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>

      {inboxNotice && (
        <div
          role="status"
          onClick={() => setInboxNotice(null)}
          style={{ position: 'fixed', top: 'calc(var(--m-top, 0px) + 12px)', left: '50%', transform: 'translateX(-50%)', zIndex: 1100, background: '#111827', color: '#fff', padding: '0.55rem 1rem', borderRadius: 999, fontSize: '0.8rem', boxShadow: 'var(--shadow-lg)', cursor: 'pointer', maxWidth: 'calc(100vw - 32px)' }}
        >
          {inboxNotice}
        </div>
      )}

      {/* ── Conversation list ──────────────────────────────────────────────── */}
      <aside className="inbox-aside" style={{ width: '320px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-soft)', background: 'var(--bg-card)', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '1rem 1rem 0', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} color="var(--brand-primary)" /> الصندوق الموحد
            </h2>
            <button
              onClick={loadConversations}
              style={{ background: 'none', border: 'none', padding: '0.3rem', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '8px' }}
              title="تحديث"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={14} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="البحث..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadConversations()}
              style={{ paddingRight: '2.2rem', fontSize: '0.83rem', background: 'var(--bg-main)', border: '1px solid var(--border-soft)', borderRadius: '10px', padding: '0.5rem 2.2rem 0.5rem 0.75rem', width: '100%', outline: 'none', color: 'var(--text-main)' }}
            />
          </div>

          {/* Owner filter */}
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.6rem' }}>
            {ownerTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setOwnerFilter(t.key)}
                style={{
                  flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  background: ownerFilter === t.key ? 'var(--brand-primary)' : 'var(--bg-main)',
                  color: ownerFilter === t.key ? '#fff' : 'var(--text-muted)',
                  transition: 'all 120ms',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: '0.3rem', paddingBottom: '0.75rem' }}>
            {statusTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                style={{
                  flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: '8px', border: `1px solid ${statusFilter === t.key ? 'var(--brand-primary)' : 'var(--border-soft)'}`, cursor: 'pointer',
                  background: statusFilter === t.key ? 'var(--brand-primary-soft)' : 'transparent',
                  color: statusFilter === t.key ? 'var(--brand-primary)' : 'var(--text-muted)',
                  transition: 'all 120ms',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pull-to-refresh indicator */}
        <div
          className="ptr-indicator"
          style={{ height: pullDistance, opacity: pullDistance / 48 }}
        >
          <RefreshCw
            size={18}
            style={{
              transform: `rotate(${pullDistance * 4}deg)`,
              animation: refreshing ? 'spin 0.8s linear infinite' : undefined,
            }}
          />
        </div>

        {/* List */}
        <div
          style={{ flex: 1, overflowY: 'auto' }}
          onTouchStart={onListTouchStart}
          onTouchMove={onListTouchMove}
          onTouchEnd={onListTouchEnd}
        >
          {loading
            ? [1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ padding: '1rem', borderBottom: '1px solid var(--border-soft)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.sk{background:linear-gradient(90deg,var(--border-soft) 25%,var(--bg-card,#1e2130) 50%,var(--border-soft) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:6px}`}</style>
                <div className="sk" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="sk" style={{ width: `${50 + (i * 13) % 35}%`, height: 12 }} />
                  <div className="sk" style={{ width: `${65 + (i * 7) % 25}%`, height: 10 }} />
                </div>
              </div>
            ))
            : conversations.length === 0
              ? (
                <MascotEmptyState
                  pose="idle"
                  size={140}
                  title="لا توجد محادثات"
                  description="أول ما يراسلك عميل على واتساب رح تظهر محادثته هون."
                />
              )
              : conversations.map(conv => (
                <ConvItem
                  key={conv._id}
                  conv={conv}
                  selected={selected?._id === conv._id}
                  onClick={() => { haptic(); selectConversation(conv); setMobileView('thread'); }}
                  roleTag={doctorRelayTags[conv.customerPhone.replace(/\D/g, '')] || null}
                />
              ))
          }
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      {/* On a phone the thread can be swiped away to go back, like a native app.
          (RTL: the back affordance is on the right, so the pane is dragged rightwards.) */}
      <motion.main
        className="inbox-main"
        drag={isMobile && selected ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.55 }}
        onDragEnd={(_e, info) => {
          if (info.offset.x > 90 || info.velocity.x > 500) {
            haptic();
            setMobileView('list');
          }
        }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', minWidth: 0 }}
      >
        {selected ? (
          <>
            {/* Chat header */}
            <header style={{ padding: '0.85rem 1.25rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <button
                  className="inbox-back-btn"
                  onClick={() => { haptic(); setMobileView('list'); }}
                  aria-label="رجوع"
                  style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)', flexShrink: 0 }}
                >
                  <ChevronRight size={22} />
                </button>
                <Avatar name={conversationName(selected)} size={42} src={selected.profilePicture} />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {conversationName(selected)}
                    {selected.aiState && selected.aiState !== 'disabled' && AI_STATE_LABEL[selected.aiState] && (
                      <span
                        title={selected.aiLastError || undefined}
                        style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 999, color: AI_STATE_LABEL[selected.aiState].color, background: AI_STATE_LABEL[selected.aiState].bg, whiteSpace: 'nowrap' }}
                      >
                        {AI_STATE_LABEL[selected.aiState].label}
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {selected.phoneNumber ? (<>
                      <Phone size={11} color="var(--text-muted)" />
                      <bdi style={{ fontSize: '0.72rem', color: 'var(--text-muted)', direction: 'ltr' }}>{formatPhone(selected.phoneNumber)}</bdi>
                    </>) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>رقم الهاتف غير متوفر</span>
                    )}
                    {(() => {
                      // "active" = last incoming message within 5 minutes
                      const lastIncoming = [...messages].reverse().find(m => m.direction === 'incoming');
                      const isActive = lastIncoming
                        ? Date.now() - new Date(lastIncoming.createdAt).getTime() < 5 * 60 * 1000
                        : false;
                      const lastAt = lastIncoming
                        ? (() => {
                            const diff = Math.floor((Date.now() - new Date(lastIncoming.createdAt).getTime()) / 60000);
                            if (diff < 1) return 'الآن';
                            if (diff < 60) return `منذ ${diff} د`;
                            const h = Math.floor(diff / 60);
                            if (h < 24) return `منذ ${h} س`;
                            return `منذ ${Math.floor(h / 24)} يوم`;
                          })()
                        : null;
                      return lastAt ? (
                        <>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isActive ? '#10b981' : '#94a3b8', display: 'inline-block' }} />
                          <span style={{ fontSize: '0.72rem', color: isActive ? '#10b981' : 'var(--text-muted)' }}>
                            {isActive ? 'نشط الآن' : `آخر ظهور ${lastAt}`}
                          </span>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <StatusPill status={selected.status} />
                {doctorRelayEnabled && canLinkConversations && !doctorRelayTags[selected.customerPhone.replace(/\D/g, '')] && (
                  <button
                    onClick={() => { setLinkModalRole('professional'); setLinkModalTargetId(''); setLinkModalError(null); setShowLinkModal(true); }}
                    title={`اربط هذه المحادثة بمحادثة أخرى (${doctorRelaySettings.professionalLabel}/${doctorRelaySettings.clientLabel})`}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Link2 size={14} /> ربط
                  </button>
                )}
                <button
                  onClick={handleAiAssist}
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '10px', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)', background: 'var(--brand-primary-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Sparkles size={14} /> AI
                </button>
                {selected.status !== 'closed' && (
                  <button
                    onClick={() => setStatus('closed')}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '10px', border: 'none', background: '#d1fae5', color: '#065f46', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <CheckCircle2 size={14} /> إغلاق
                  </button>
                )}
                {canClaim && !selected.assignedTo && (
                  <button
                    onClick={claimConv}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '10px', border: 'none', background: 'var(--brand-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <UserPlus size={14} /> اتخذ
                  </button>
                )}
              </div>
            </header>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleChatScroll}
              className="msg-area-bg chat-scroll"
              style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}
            >
              {messagesLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start' }}>
                      <div style={{ width: `${140 + i * 30}px`, height: 40, borderRadius: 16, background: 'var(--border-soft)', opacity: 0.6 }} />
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <Loader2 size={18} color="var(--brand-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '2rem' }}>
                  <MascotEmptyState pose="phone" size={140} title="لا توجد رسائل بعد" />
                </div>
              ) : null}
              {!messagesLoading && messageGroups.map((group, gi) => (
                <div key={gi}>
                  {/* Date separator — sticks to the top while scrolling on mobile */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0 0.75rem' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-soft)' }} />
                    <span className="day-chip" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{dateLabel(group.date)}</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-soft)' }} />
                  </div>

                  {group.items.map((titem, mi) => {
                    if (titem._type === 'note') {
                      const n = titem.item;
                      return (
                        <motion.div
                          key={titem._id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}
                        >
                          <div style={{ maxWidth: '75%', background: '#fffbeb', border: '1px solid #fcd34d88', borderRadius: '14px', padding: '0.6rem 0.9rem', fontSize: '0.85rem', lineHeight: 1.6, wordBreak: 'break-word' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                              <StickyNote size={13} color="#d97706" />
                              <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>ملاحظة داخلية</span>
                              {n.author?.name && <span style={{ fontSize: '0.67rem', color: '#92400e' }}>• {n.author.name}</span>}
                            </div>
                            <span style={{ color: '#78350f' }}>{n.note}</span>
                            <div style={{ fontSize: '0.62rem', color: '#a16207', marginTop: '0.25rem', textAlign: 'left' }}>{formatTime(n.createdAt)}</div>
                          </div>
                        </motion.div>
                      );
                    }

                    const msg = titem.item;
                    const isOut = msg.direction === 'outgoing';
                    // Phone-sent: outgoing with no sentByUserId → label = "الهاتف"
                    const senderLabel = msg.sentByUserNameSnapshot || (isOut && !msg.sentByUserId ? 'الهاتف' : null);
                    const prevItem = group.items[mi - 1];
                    const prevMsg = prevItem?._type === 'message' ? prevItem.item : null;
                    const prevSenderLabel = prevMsg ? (prevMsg.sentByUserNameSnapshot || (prevMsg.direction === 'outgoing' && !prevMsg.sentByUserId ? 'الهاتف' : null)) : null;
                    const showAgent = isOut && (!prevMsg || prevMsg.direction !== 'outgoing' || prevSenderLabel !== senderLabel);
                    const hasMedia = msg.messageType === 'image' || msg.messageType === 'document' || (msg.mediaMimeType && msg.mediaMimeType !== 'text/plain');
                    return (
                      <motion.div
                        key={msg._id}
                        // Bubbles spring in from the side they belong to.
                        initial={{ opacity: 0, y: 10, scale: 0.96, x: isOut ? 12 : -12 }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start', marginBottom: '0.15rem' }}
                      >
                        {showAgent && senderLabel && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>
                            {/* AI replies are signed by the mascot instead of initials. */}
                            {senderLabel === 'المساعد الذكي'
                              ? <MascotFaceAvatar face="face-happy" size={22} />
                              : <Avatar name={senderLabel} size={18} />}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {senderLabel}
                            </span>
                          </div>
                        )}
                        <div style={{
                          maxWidth: '70%',
                          padding: '0.6rem 0.9rem 0.45rem',
                          borderRadius: isOut ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isOut ? 'var(--brand-primary)' : '#fff',
                          color: isOut ? '#fff' : 'var(--text-main)',
                          boxShadow: isOut ? '0 2px 8px rgba(6, 78, 59,0.25)' : '0 1px 4px rgba(0,0,0,0.1)',
                          fontSize: '0.875rem',
                          lineHeight: 1.6,
                          wordBreak: 'break-word',
                          border: isOut ? 'none' : '1px solid rgba(0,0,0,0.06)',
                        }}>
                          {hasMedia ? <MediaBubble msg={msg} isOut={isOut} /> : null}
                          {msg.body && <span style={{ display: 'block', marginTop: hasMedia ? '0.35rem' : 0, whiteSpace: 'pre-wrap' }}>{msg.body}</span>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                            {msg.isEdited && (
                              <span
                                title={msg.editedAt ? `عُدّلت ${formatTime(msg.editedAt)}` : undefined}
                                style={{ fontSize: '0.62rem', fontStyle: 'italic', color: isOut ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
                              >
                                تم التعديل
                              </span>
                            )}
                            <span style={{ fontSize: '0.62rem', color: isOut ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(msg.createdAt)}</span>
                            {isOut && <MsgStatus status={msg.status} />}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Jump to latest — appears once the user scrolls up */}
            <AnimatePresence>
              {!atBottom && (
                <motion.button
                  className="scroll-bottom-fab"
                  initial={{ opacity: 0, scale: 0.7, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.7, y: 10 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  onClick={jumpToLatest}
                  aria-label="الذهاب لآخر رسالة"
                >
                  <ChevronDown size={20} />
                  {newBelowCount > 0 && (
                    <span style={{ position: 'absolute', top: -4, insetInlineEnd: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--brand-primary)', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {newBelowCount > 9 ? '9+' : newBelowCount}
                    </span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Slash command menu */}
            <AnimatePresence>
              {slashMenu.visible && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  style={{ margin: '0 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: '14px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
                >
                  <div style={{ padding: '0.6rem 1rem', background: 'var(--brand-primary-soft)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={14} color="var(--brand-primary)" fill="var(--brand-primary)" />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-primary)' }}>الردود السريعة</span>
                    <button onClick={() => setSlashMenu({ visible: false, filter: '' })} style={{ marginRight: 'auto', background: 'none', border: 'none', padding: '0.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={13} /></button>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {filteredReplies.length > 0 ? filteredReplies.map(r => (
                      <div
                        key={r._id}
                        onClick={() => insertReply(r.message)}
                        style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-soft)', cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-main)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{r.title}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</div>
                      </div>
                    )) : (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>لا توجد ردود مطابقة</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Media preview bar */}
            {mediaPreview && (
              <div style={{ padding: '0.6rem 1rem', background: 'var(--brand-primary-soft)', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                {mediaPreview.mimetype.startsWith('image/') ? (
                  <img src={mediaPreview.objectUrl} alt={mediaPreview.filename} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '2px solid var(--brand-primary)33' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--brand-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={22} color="var(--brand-primary)" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mediaPreview.filename}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{mediaPreview.mimetype}</div>
                </div>
                <button onClick={() => { URL.revokeObjectURL(mediaPreview.objectUrl); setMediaPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Typing indicator */}
            {Object.keys(typingUsers).length > 0 && (
              <div style={{ padding: '0.3rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', borderTop: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {Object.values(typingUsers).join('، ')} جاري الكتابة...
                </span>
                <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}`}</style>
              </div>
            )}

            {/* Input — WhatsApp Web style */}
            <div className="chat-composer" style={{ padding: '0.5rem 1rem 0.6rem', background: 'var(--bg-card)', borderTop: Object.keys(typingUsers).length > 0 ? 'none' : '1px solid var(--border-soft)', flexShrink: 0 }}>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" style={{ display: 'none' }} onChange={pickMedia} />

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.45rem' }}>
                <button
                  onClick={() => setInputMode('message')}
                  style={{ padding: '0.22rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '999px', border: `1.5px solid ${inputMode === 'message' ? 'var(--brand-primary)' : 'var(--border-soft)'}`, background: inputMode === 'message' ? 'var(--brand-primary-soft)' : 'transparent', color: inputMode === 'message' ? 'var(--brand-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.12s' }}
                >
                  <Send size={11} /> رسالة
                </button>
                <button
                  onClick={() => setInputMode('note')}
                  style={{ padding: '0.22rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '999px', border: `1.5px solid ${inputMode === 'note' ? '#d97706' : 'var(--border-soft)'}`, background: inputMode === 'note' ? '#fffbeb' : 'transparent', color: inputMode === 'note' ? '#d97706' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.12s' }}
                >
                  <StickyNote size={11} /> ملاحظة داخلية
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>

                {/* Attach button — only in message mode */}
                {inputMode === 'message' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="إرفاق صورة أو ملف"
                    style={{
                      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg-main)', border: '1.5px solid var(--border-medium)',
                      color: 'var(--text-main)', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.color = 'var(--brand-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                  >
                    <Paperclip size={22} strokeWidth={2} style={{ display: 'block', flexShrink: 0 }} />
                  </button>
                )}

                {/* Text input */}
                <div style={{ flex: 1, background: inputMode === 'note' ? '#fffbeb' : 'var(--bg-main)', borderRadius: '24px', padding: '0.6rem 1rem', minHeight: '44px', display: 'flex', alignItems: 'center', border: inputMode === 'note' ? '1.5px solid #fcd34d' : '1.5px solid transparent', transition: 'all 0.15s' }}>
                  <textarea
                    ref={inputRef}
                    placeholder={inputMode === 'note' ? 'اكتب ملاحظة داخلية (لن يراها العميل)...' : mediaPreview ? 'تعليق على الملف (اختياري)...' : 'اكتب رسالة...'}
                    value={draft}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    style={{ width: '100%', resize: 'none', border: 'none', background: 'none', outline: 'none', fontSize: '0.9rem', color: inputMode === 'note' ? '#78350f' : 'var(--text-main)', lineHeight: 1.5, maxHeight: '120px', minHeight: '20px', padding: 0, fontFamily: 'inherit', overflowY: 'auto', display: 'block' }}
                  />
                </div>

                {/* Send button */}
                <button
                  onClick={() => {
                    if (sending || someoneElseTyping) return;
                    if (inputMode === 'note') { if (draft.trim()) sendNote(); return; }
                    if (!draft.trim() && !mediaPreview) return;
                    if (mediaPreview) sendMedia(); else sendMessage();
                  }}
                  title={someoneElseTyping ? `${Object.values(typingUsers).join('، ')} جاري الكتابة...` : inputMode === 'note' ? 'حفظ الملاحظة' : 'إرسال'}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: someoneElseTyping ? '#94a3b8' : inputMode === 'note' ? '#d97706' : 'var(--brand-primary)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: (draft.trim() || (inputMode === 'message' && mediaPreview)) && !sending && !someoneElseTyping ? 'pointer' : 'default',
                    boxShadow: someoneElseTyping ? 'none' : inputMode === 'note' ? '0 2px 8px rgba(217,119,6,0.3)' : '0 2px 8px rgba(6, 78, 59,0.3)',
                    opacity: (draft.trim() || (inputMode === 'message' && mediaPreview)) && !someoneElseTyping ? 1 : 0.4,
                    transition: 'all 0.15s',
                  }}
                >
                  {sending
                    ? <Loader2 size={22} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                    : inputMode === 'note'
                      ? <StickyNote size={20} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0 }} />
                      : <Send size={22} strokeWidth={2.5} style={{ display: 'block', flexShrink: 0 }} />}
                </button>

              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <MascotEmptyState
              pose="pointing"
              title="اختر محادثة"
              description="افتح أي محادثة من القائمة للتواصل مع العميل مباشرةً عبر واتساب."
            />
          </div>
        )}
      </motion.main>

      {/* ── Right context panel ───────────────────────────────────────────── */}
      <aside className="inbox-details" style={{ width: '280px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-soft)', background: 'var(--bg-card)', flexShrink: 0, overflowY: 'auto' }}>
        {selected ? (
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Customer card */}
            <section style={{ background: 'var(--bg-main)', borderRadius: '14px', padding: '1rem', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Avatar name={conversationName(selected)} size={56} src={selected.profilePicture} />
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {editingName ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); saveContactName(); }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
                    >
                      <input
                        autoFocus
                        value={nameDraft}
                        maxLength={80}
                        onChange={(e) => setNameDraft(e.target.value)}
                        placeholder="اسم داخلي (مثال: زبون رقم 1)"
                        style={{ height: 36, fontSize: '0.83rem', textAlign: 'center' }}
                      />
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="btn-primary" type="submit" disabled={nameSaving} style={{ flex: 1, height: 32, fontSize: '0.75rem' }}>
                          {nameSaving ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                        <button className="btn-ghost" type="button" onClick={() => setEditingName(false)} style={{ height: 32, fontSize: '0.75rem' }}>
                          إلغاء
                        </button>
                      </div>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>اتركه فارغاً لاستعادة الاسم القادم من واتساب</span>
                    </form>
                  ) : (
                    <>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        {conversationName(selected)}
                        {canEditContact && (
                          <button
                            type="button"
                            onClick={startEditName}
                            title="تعديل اسم جهة الاتصال"
                            style={{ padding: 4, height: 'auto', background: 'transparent', color: 'var(--brand-primary)', fontSize: '0.7rem' }}
                          >
                            تعديل
                          </button>
                        )}
                      </h4>
                      {selected.customName && selected.customerName && selected.customName !== selected.customerName && (
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>الاسم على واتساب: {selected.customerName}</p>
                      )}
                    </>
                  )}
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    {selected.phoneNumber ? (
                      <>
                        <bdi style={{ fontSize: '0.8rem', color: 'var(--text-main)', direction: 'ltr', fontWeight: 600 }}>{formatPhone(selected.phoneNumber)}</bdi>
                        <button
                          type="button"
                          onClick={() => copyPhone(selected.phoneNumber!)}
                          title="نسخ الرقم"
                          style={{ padding: '2px 8px', height: 'auto', fontSize: '0.68rem', borderRadius: 999, background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' }}
                        >
                          {copiedPhone ? <><Check size={11} /> نُسخ</> : 'نسخ'}
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>رقم الهاتف غير متوفر</span>
                    )}
                  </div>
                </div>
              </div>
              {selected.aiState && selected.aiState !== 'disabled' && (
                <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999, color: AI_STATE_LABEL[selected.aiState]?.color, background: AI_STATE_LABEL[selected.aiState]?.bg }}>
                      {AI_STATE_LABEL[selected.aiState]?.label}
                    </span>
                    {selected.aiState === 'failed' && selected.aiLastError && (
                      <p style={{ fontSize: '0.66rem', color: '#b91c1c', margin: '0.35rem 0 0' }}>{selected.aiLastError}</p>
                    )}
                  </div>
                  {canManageAi && selected.aiState !== 'processing' && (
                    <button
                      type="button"
                      onClick={toggleConversationAi}
                      style={{ padding: '0.3rem 0.7rem', height: 'auto', fontSize: '0.7rem', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-main)' }}
                    >
                      {selected.aiState === 'active' ? 'إيقاف AI' : 'تشغيل AI'}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: '12px', padding: '3px', gap: '2px' }}>
              {([['info', 'التفاصيل', <User size={12} />], ['notes', 'ملاحظات', <StickyNote size={12} />], ['ai', 'AI', <Sparkles size={12} />]] as const).map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => setRightTab(key)}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '9px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: rightTab === key ? 'var(--bg-card)' : 'transparent', color: rightTab === key ? 'var(--brand-primary)' : 'var(--text-muted)', boxShadow: rightTab === key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {rightTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Status */}
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>الحالة</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {(['open', 'pending', 'closed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: '9px', border: `1px solid ${selected.status === s ? 'var(--brand-primary)' : 'var(--border-soft)'}`, cursor: 'pointer', background: selected.status === s ? 'var(--brand-primary-soft)' : 'transparent', color: selected.status === s ? 'var(--brand-primary)' : 'var(--text-muted)' }}
                      >
                        {s === 'open' ? 'مفتوح' : s === 'pending' ? 'معلق' : 'مغلق'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assign */}
                {canAssign && (
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>تعيين لـ</label>
                    <select
                      value={selected.assignedTo?.id || ''}
                      onChange={e => assignConv(e.target.value)}
                      style={{ width: '100%', fontSize: '0.83rem', padding: '0.55rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }}
                    >
                      <option value="">— غير معين —</option>
                      {employees.map(e => { const eid = e._id || e.id; return <option key={eid} value={eid}>{e.name}</option>; })}
                    </select>
                    {selected.assignedTo && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Avatar name={selected.assignedTo.name} size={24} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{selected.assignedTo.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {(selected.tags?.length ?? 0) > 0 && (
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>التصنيفات</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {selected.tags?.map(tag => (
                        <span key={tag._id} style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {rightTab === 'notes' && (
              <div>
                <form onSubmit={addNote}>
                  <textarea
                    placeholder="ملاحظة داخلية للفريق (لن يراها العميل)..."
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    style={{ width: '100%', minHeight: '70px', fontSize: '0.82rem', padding: '0.6rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-soft)', background: 'var(--bg-main)', color: 'var(--text-main)', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                  <button className="btn-secondary" type="submit" style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.8rem', borderRadius: '10px' }}>
                    <StickyNote size={14} /> إضافة ملاحظة
                  </button>
                </form>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {notes.map(n => (
                    <div key={n._id} style={{ background: '#fffbeb', border: '1px solid #fcd34d44', borderRadius: '10px', padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.8rem', margin: '0 0 0.35rem', lineHeight: 1.5 }}>{n.note}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {n.author && <Avatar name={n.author.name} size={16} />}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{n.author?.name} • {new Date(n.createdAt).toLocaleDateString('ar-SY')}</span>
                      </div>
                    </div>
                  ))}
                  {notes.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>لا توجد ملاحظات</p>}
                </div>
              </div>
            )}

            {rightTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {aiLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--brand-primary)' }}>
                    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.82rem' }}>جاري تحليل المحادثة...</p>
                  </div>
                ) : (
                  <>
                    {aiSummary && (
                      <div style={{ background: 'var(--brand-primary-soft)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--brand-primary)22' }}>
                        <h5 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>ملخص المحادثة</h5>
                        <p style={{ fontSize: '0.82rem', lineHeight: 1.55, margin: 0 }}>{aiSummary}</p>
                      </div>
                    )}
                    <div>
                      <h5 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>اقتراحات ذكية</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {aiSuggestions.map((s, i) => (
                          <div
                            key={i}
                            onClick={() => setDraft(s)}
                            style={{ padding: '0.65rem', background: 'var(--bg-main)', border: '1px solid var(--border-soft)', borderRadius: '10px', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1.5 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.background = 'var(--brand-primary-soft)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-soft)'; e.currentTarget.style.background = 'var(--bg-main)'; }}
                          >
                            {s}
                          </div>
                        ))}
                        {aiSuggestions.length === 0 && (
                          <button onClick={handleAiAssist} style={{ padding: '0.6rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: '10px', border: '1px dashed var(--brand-primary)', color: 'var(--brand-primary)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                            <Sparkles size={14} /> توليد اقتراحات
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <AlertCircle size={28} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.82rem' }}>اختر محادثة لعرض التفاصيل</p>
          </div>
        )}
      </aside>

      {showLinkModal && selected && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowLinkModal(false)}
        >
          <div
            className="card"
            style={{ width: 'min(420px, calc(100vw - 48px))', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              ربط "{conversationName(selected)}" بمحادثة أخرى
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              ربط واحد يكفي للاتجاهين — أي رسالة من أي طرف تصل للآخر تلقائياً، بدون أن يرى أحدهما رقم الآخر.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                هذه المحادثة هي:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setLinkModalRole('professional')}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${linkModalRole === 'professional' ? 'var(--brand-primary)' : 'var(--border-soft)'}`, background: linkModalRole === 'professional' ? 'var(--brand-primary-soft)' : 'transparent', color: linkModalRole === 'professional' ? 'var(--brand-primary)' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {doctorRelaySettings.professionalLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setLinkModalRole('client')}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1px solid ${linkModalRole === 'client' ? 'var(--brand-primary)' : 'var(--border-soft)'}`, background: linkModalRole === 'client' ? 'var(--brand-primary-soft)' : 'transparent', color: linkModalRole === 'client' ? 'var(--brand-primary)' : 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {doctorRelaySettings.clientLabel}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                اربطها بـ ({linkModalRole === 'professional' ? doctorRelaySettings.clientLabel : doctorRelaySettings.professionalLabel}):
              </label>
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <Search size={14} style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={linkModalSearch}
                  onChange={(e) => setLinkModalSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الرقم..."
                  style={{ width: '100%', paddingRight: '2rem' }}
                />
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-soft)', borderRadius: '8px' }}>
                {conversations
                  .filter((c) => c._id !== selected._id)
                  .filter((c) => {
                    const q = linkModalSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      conversationName(c).toLowerCase().includes(q) ||
                      (c.customerName || '').toLowerCase().includes(q) ||
                      c.customerPhone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
                    );
                  })
                  .slice(0, 50)
                  .map((c) => {
                    const isSel = linkModalTargetId === c._id;
                    return (
                      <div
                        key={c._id}
                        onClick={() => setLinkModalTargetId(c._id)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.55rem 0.75rem', cursor: 'pointer',
                          background: isSel ? 'var(--brand-primary-soft)' : 'transparent',
                          borderBottom: '1px solid var(--border-soft)',
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', fontWeight: isSel ? 700 : 500, color: isSel ? 'var(--brand-primary)' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conversationName(c)}
                        </span>
                        <bdi style={{ fontSize: '0.72rem', color: 'var(--text-muted)', direction: 'ltr', unicodeBidi: 'embed' }}>
                          {c.customerPhone.replace(/\D/g, '')}
                        </bdi>
                      </div>
                    );
                  })}
                {conversations.filter((c) => c._id !== selected._id).length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    لا توجد محادثات أخرى
                  </div>
                )}
              </div>
            </div>

            {linkModalError && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: '0.8rem' }}>
                {linkModalError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                disabled={linkModalSubmitting || !linkModalTargetId}
                onClick={submitLinkModal}
              >
                {linkModalSubmitting ? 'جاري الربط...' : 'إنشاء الربط'}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setShowLinkModal(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Flat chat background — the dotted wash was dropped with the gradients. */
        .msg-area-bg { background-color: var(--bg-main); }

        /* ── Mobile inbox: single pane (list ↔ thread) ── */
        @media (max-width: 768px) {
          .inbox-container {
            height: calc(100dvh - var(--m-top) - var(--m-bottom)) !important;
            position: relative;
          }
          .inbox-aside, .inbox-main {
            position: absolute;
            inset: 0;
            width: 100% !important;
            border: none !important;
          }
          /* Details panel is not shown on mobile to keep the chat full-width */
          .inbox-details { display: none !important; }
          /* Toggle panes based on the container's data-mv */
          .inbox-container[data-mv="list"] .inbox-main { display: none; }
          .inbox-container[data-mv="thread"] .inbox-aside { display: none; }
          /* Show the back button only on mobile */
          .inbox-back-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
