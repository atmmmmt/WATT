import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty({ example: 'Growth Annual' })
  @IsString()
  planName: string;

  @ApiProperty({ example: 12, description: '6 = six months, 12 = one year, 120 = ten years' })
  @IsInt()
  @Min(1)
  durationMonths: number;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(1)
  maxMonthlyOtp: number;

  @ApiProperty({ example: 499 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Enterprise contract' })
  @IsOptional()
  @IsString()
  notes?: string;
}
