import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLandingOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  planId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(140)
  companyName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  phoneNumber: string;

  @IsEmail()
  @MaxLength(180)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  useCase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(900)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
