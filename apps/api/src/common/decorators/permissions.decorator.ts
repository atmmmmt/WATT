import { SetMetadata } from '@nestjs/common';
import { SupportPermissionValue } from '../utils/support-permissions.util';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: SupportPermissionValue[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
