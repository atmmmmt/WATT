import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateContactDto {
  @ApiProperty({ description: 'Internal display name. Empty string restores the WhatsApp name.' })
  @IsString()
  @MaxLength(80)
  customName: string;
}
