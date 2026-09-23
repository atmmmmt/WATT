import { UserRole } from '../../modules/users/schemas/user.schema';

export const SupportPermission = {
  WHATSAPP_MANAGE: 'support.whatsapp.manage',
  CONVERSATIONS_VIEW_ALL: 'support.conversations.view_all',
  CONVERSATIONS_VIEW_ASSIGNED: 'support.conversations.view_assigned',
  CONVERSATIONS_VIEW_UNASSIGNED: 'support.conversations.view_unassigned',
  CONVERSATIONS_REPLY: 'support.conversations.reply',
  CONVERSATIONS_ASSIGN: 'support.conversations.assign',
  CONVERSATIONS_CLOSE: 'support.conversations.close',
  CONVERSATIONS_CLAIM: 'support.conversations.claim',
  NOTES_MANAGE: 'support.notes.manage',
  CONTACTS_EDIT: 'support.contacts.edit',
  AI_MANAGE: 'support.ai.manage',
  QUICK_REPLIES_MANAGE: 'support.quick_replies.manage',
  TAGS_MANAGE: 'support.tags.manage',
  REPORTS_VIEW: 'support.reports.view',
  EMPLOYEES_MANAGE: 'support.employees.manage',
  SETTINGS_MANAGE: 'support.settings.manage',
} as const;

export type SupportPermissionValue =
  (typeof SupportPermission)[keyof typeof SupportPermission];

const ROLE_PERMISSIONS: Record<UserRole, SupportPermissionValue[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(SupportPermission),
  [UserRole.TENANT_ADMIN]: Object.values(SupportPermission),
  [UserRole.HR_MANAGER]: [],
  [UserRole.RECRUITER]: [],
  [UserRole.ADMIN]: Object.values(SupportPermission),
  [UserRole.SUPERVISOR]: [
    SupportPermission.CONVERSATIONS_VIEW_ALL,
    SupportPermission.CONVERSATIONS_VIEW_ASSIGNED,
    SupportPermission.CONVERSATIONS_VIEW_UNASSIGNED,
    SupportPermission.CONVERSATIONS_REPLY,
    SupportPermission.CONVERSATIONS_ASSIGN,
    SupportPermission.CONVERSATIONS_CLOSE,
    SupportPermission.NOTES_MANAGE,
    SupportPermission.CONTACTS_EDIT,
    SupportPermission.AI_MANAGE,
    SupportPermission.QUICK_REPLIES_MANAGE,
    SupportPermission.TAGS_MANAGE,
    SupportPermission.REPORTS_VIEW,
  ],
  [UserRole.AGENT]: [
    SupportPermission.CONVERSATIONS_VIEW_ASSIGNED,
    SupportPermission.CONVERSATIONS_VIEW_UNASSIGNED,
    SupportPermission.CONVERSATIONS_REPLY,
    SupportPermission.CONVERSATIONS_CLOSE,
    SupportPermission.CONVERSATIONS_CLAIM,
    SupportPermission.NOTES_MANAGE,
    SupportPermission.CONTACTS_EDIT,
  ],
};

export function defaultPermissionsForRole(role: UserRole): SupportPermissionValue[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function mergePermissions(
  role: UserRole,
  permissions?: string[] | null,
): SupportPermissionValue[] {
  const explicit = (permissions || []).filter(Boolean) as SupportPermissionValue[];
  return Array.from(new Set([...defaultPermissionsForRole(role), ...explicit]));
}

export function hasSupportPermission(
  user: { role: UserRole; permissions?: string[] | null },
  permission: SupportPermissionValue,
) {
  return mergePermissions(user.role, user.permissions).includes(permission);
}
