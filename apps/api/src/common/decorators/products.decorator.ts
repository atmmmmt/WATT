import { SetMetadata } from '@nestjs/common';
import { TenantProduct } from '../../modules/tenants/schemas/tenant.schema';

export const PRODUCTS_KEY = 'products';
export const Products = (...products: TenantProduct[]) =>
  SetMetadata(PRODUCTS_KEY, products);
