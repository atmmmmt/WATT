import type { AuthUser } from '../context/AuthContext';

// Mirrors the backend permission ids. `user.permissions` from /auth/me is already the
// effective list (role defaults + explicit grants) computed by the API, so the UI shows
// exactly the actions the API will accept.
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

export function can(user: AuthUser | null | undefined, permission: PermissionValue) {
  return !!user?.permissions?.includes(permission);
}

export function canCreateRoutingLink(user: AuthUser | null | undefined) {
  return can(user, Permission.ROUTING_LINKS_CREATE);
}
