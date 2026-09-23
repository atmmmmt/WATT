import { UserRole } from '../../modules/users/schemas/user.schema';

/**
 * Single source of truth for routing-link ("روابط التوجيه") access. The dashboard reads
 * the same values from `user.permissions` (see sanitizeUser), so a button is only shown
 * when this backend will actually accept the request.
 *
 * - LINKS_CREATE: create a link (and the doctor/patient directory records it needs).
 * - LINKS_MANAGE: label settings + closing ANY link. Holders of LINKS_CREATE alone may
 *   close only the links they created themselves.
 */
export const DoctorRelayPermission = {
  LINKS_MANAGE: 'doctor_relay.links.manage',
  LINKS_CREATE: 'doctor_relay.links.create',
  LINKS_VIEW: 'doctor_relay.links.view',
  CONVERSATIONS_VIEW: 'doctor_relay.conversations.view',
  CONVERSATIONS_INTERVENE: 'doctor_relay.conversations.intervene',
} as const;

export type DoctorRelayPermissionValue =
  (typeof DoctorRelayPermission)[keyof typeof DoctorRelayPermission];

const ROLE_PERMISSIONS: Record<UserRole, DoctorRelayPermissionValue[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(DoctorRelayPermission),
  [UserRole.TENANT_ADMIN]: Object.values(DoctorRelayPermission),
  [UserRole.HR_MANAGER]: [],
  [UserRole.RECRUITER]: [],
  [UserRole.ADMIN]: Object.values(DoctorRelayPermission),
  [UserRole.SUPERVISOR]: [
    DoctorRelayPermission.LINKS_CREATE,
    DoctorRelayPermission.LINKS_VIEW,
    DoctorRelayPermission.CONVERSATIONS_VIEW,
  ],
  [UserRole.AGENT]: [],
};

export function defaultDoctorRelayPermissionsForRole(
  role: UserRole,
): DoctorRelayPermissionValue[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function mergeDoctorRelayPermissions(
  role: UserRole,
  permissions?: string[] | null,
): DoctorRelayPermissionValue[] {
  const explicit = (permissions || []).filter(Boolean) as DoctorRelayPermissionValue[];
  return Array.from(
    new Set([...defaultDoctorRelayPermissionsForRole(role), ...explicit]),
  );
}

export function hasDoctorRelayPermission(
  user: { role: UserRole; permissions?: string[] | null },
  permission: DoctorRelayPermissionValue,
) {
  return mergeDoctorRelayPermissions(user.role, user.permissions).includes(permission);
}
