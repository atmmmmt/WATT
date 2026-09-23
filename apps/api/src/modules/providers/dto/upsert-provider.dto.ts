import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ProviderType } from '../schemas/provider-account.schema';

export class UpsertProviderDto {
  @ApiProperty({ example: 'tenantId' })
  @IsString()
  tenantId: string;

  @ApiProperty({ enum: Object.values(ProviderType), example: ProviderType.MOCK })
  @IsIn(Object.values(ProviderType))
  providerType: ProviderType;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], example: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({
    type: Object,
    example: { accountSid: 'AC...', authToken: '***', fromNumber: '+14155238886' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
