import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum } from 'class-validator';
import { TenantProduct } from '../schemas/tenant.schema';

export class UpdateTenantProductsDto {
  @ApiProperty({ enum: TenantProduct, isArray: true })
  @IsArray()
  @IsEnum(TenantProduct, { each: true })
  enabledProducts: TenantProduct[];
}
