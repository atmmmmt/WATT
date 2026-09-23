import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class LinkPartyDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'WhatsApp chat id from the support conversation, if known' })
  @IsOptional()
  @IsString()
  chatId?: string;
}

export class LinkConversationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ type: LinkPartyDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LinkPartyDto)
  professional: LinkPartyDto;

  @ApiProperty({ type: LinkPartyDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LinkPartyDto)
  client: LinkPartyDto;
}
