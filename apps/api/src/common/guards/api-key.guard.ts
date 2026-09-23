import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'];

    if (!rawKey || Array.isArray(rawKey)) {
      throw new UnauthorizedException('Missing API key');
    }

    const tenantContext = await this.apiKeysService.validateRawKey(rawKey);

    if (!tenantContext) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    const origin = request.headers.origin;
    const allowedOrigins = tenantContext.tenant?.allowedOrigins || [];

    if (
      origin &&
      allowedOrigins.length > 0 &&
      !allowedOrigins.includes(origin)
    ) {
      throw new UnauthorizedException(
        'This frontend origin is not allowed for the tenant',
      );
    }

    request.tenantContext = tenantContext;
    return true;
  }
}
