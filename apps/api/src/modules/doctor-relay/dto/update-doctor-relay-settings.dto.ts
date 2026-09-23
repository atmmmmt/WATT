import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDoctorRelaySettingsDto {
  @ApiPropertyOptional({ description: 'Label shown instead of "الطبيب", e.g. "المهندس"' })
  @IsOptional()
  @IsString()
  professionalLabel?: string;

  @ApiPropertyOptional({ description: 'Label shown instead of "المريض", e.g. "العميل"' })
  @IsOptional()
  @IsString()
  clientLabel?: string;
}
