import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PRODUCTS_KEY } from '../decorators/products.decorator';
import { TenantProduct } from '../../modules/tenants/schemas/tenant.schema';
import { TenantsService } from '../../modules/tenants/tenants.service';

@Injectable()
export class ProductGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantsService: TenantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const products = this.reflector.getAllAndOverride<TenantProduct[]>(
      PRODUCTS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!products || products.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;
    const user = request.user;

    if (tenantContext) {
      const enabledProducts = tenantContext.enabledProducts || [];
      if (products.some((product) => enabledProducts.includes(product))) {
        return true;
      }
      throw new ForbiddenException('This product is not enabled for this tenant');
    }

    if (!user?.tenantId) {
      return true;
    }

    const tenant = await this.tenantsService.findById(user.tenantId);
    const enabledProducts = tenant.enabledProducts || [];

    if (products.some((product) => enabledProducts.includes(product))) {
      return true;
    }

    throw new ForbiddenException('This product is not enabled for this tenant');
  }
}
