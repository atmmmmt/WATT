import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '../../modules/users/schemas/user.schema';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole; tenantId?: string | null } | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('This account is not linked to a company');
    }

    return true;
  }
}
