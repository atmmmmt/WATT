import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { WhatsAppOtpService } from './whatsapp-otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('WhatsApp OTP')
@Controller('whatsapp-otp')
export class WhatsAppOtpController {
  constructor(private readonly whatsappOtpService: WhatsAppOtpService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP code via WhatsApp' })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        message: 'OTP sent successfully via WhatsApp',
        expiresIn: 300,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid phone number or failed to send',
  })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.whatsappOtpService.sendOtp(sendOtpDto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      example: {
        verified: true,
        message: 'OTP verified successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP code, expired, or max attempts exceeded',
  })
  @ApiResponse({
    status: 404,
    description: 'No active OTP found for this phone number',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.whatsappOtpService.verifyOtp(verifyOtpDto);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if phone number has active OTP' })
  @ApiResponse({
    status: 200,
    description: 'Returns whether phone number has active OTP',
    schema: {
      example: {
        hasActiveOtp: true,
      },
    },
  })
  async checkActiveOtp(@Query('phoneNumber') phoneNumber: string) {
    const hasActiveOtp = await this.whatsappOtpService.hasActiveOtp(phoneNumber);
    return { hasActiveOtp };
  }
}

