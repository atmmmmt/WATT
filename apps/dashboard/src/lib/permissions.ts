import type { AuthUser } from '../context/AuthContext';

// Mirrors the backend permission ids. `user.permissions` normally contains the effective
// grants returned by /auth/me, but we also mirror the backend role defaults here so older
// sessions/users created before the permission fields existed do not lose valid UI access.
export const Permission = {
  CONVERSATIONS_ASSIGN: 'support.conversations.assign',
  CONVERSATIONS_CLAIM: 'support.conversations.claim',
  CONVERSATIONS_REPLY: 'support.conversations.reply',
  NOTES_MANAGE: 'support.notes.manage',
  CONTACTS_EDIT: 'support.contacts.edit',
  AI_MANAGE: 'support.ai.manage',
  SETTINGS_MANAGE: 'support.settings.manage',
  ROUTING_LINKS_VIEW: 'doctor_relay.links.view',
  ROUTING_LINKS_CREATE: 'doctor_relay.links.create',
  ROUTING_LINKS_MANAGE: 'doctor_relay.links.manage',
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

const DOCTOR_RELAY_ROLE_DEFAULTS: Record<string, PermissionValue[]> = {
  super_admin: [
    Permission.ROUTING_LINKS_VIEW,
    Permission.ROUTING_LINKS_CREATE,
    Permission.ROUTING_LINKS_MANAGE,
  ],
  tenant_admin: [
    Permission.ROUTING_LINKS_VIEW,
    Permission.ROUTING_LINKS_CREATE,
    Permission.ROUTING_LINKS_MANAGE,
  ],
  admin: [
    Permission.ROUTING_LINKS_VIEW,
    Permission.ROUTING_LINKS_CREATE,
    Permission.ROUTING_LINKS_MANAGE,
  ],
  supervisor: [
    Permission.ROUTING_LINKS_VIEW,
    Permission.ROUTING_LINKS_CREATE,
  ],
  agent: [],
  hr_manager: [],
  recruiter: [],
};

export function can(user: AuthUser | null | undefined, permission: PermissionValue) {
  if (!user) return false;
  if (user.permissions?.includes(permission)) return true;
  return (DOCTOR_RELAY_ROLE_DEFAULTS[user.role] || []).includes(permission);
}

export function canCreateRoutingLink(user: AuthUser | null | undefined) {
  return can(user, Permission.ROUTING_LINKS_CREATE);
}
