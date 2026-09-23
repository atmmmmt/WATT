import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { OtpCode } from './otp.entity';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class WhatsAppOtpService {
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 3;
  private readonly OTP_LENGTH = 6;

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepository: Repository<OtpCode>,
  ) {}

  /**
   * Generate a random 6-digit OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP code via WhatsApp
   * In production, integrate with WhatsApp Business API or a service like Twilio
   */
  private async sendWhatsAppMessage(
    phoneNumber: string,
    code: string,
  ): Promise<void> {
    // TODO: Integrate with WhatsApp Business API
    // Example: Using Twilio WhatsApp API or WhatsApp Cloud API
    console.log(`📱 Sending OTP to ${phoneNumber}: ${code}`);
    
    // Placeholder for actual WhatsApp integration
    // You can use:
    // - Twilio WhatsApp API
    // - WhatsApp Cloud API (Meta)
    // - Other WhatsApp Business API providers
    
    // Example with Twilio:
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({
    //   from: 'whatsapp:+14155238886',
    //   to: `whatsapp:${phoneNumber}`,
    //   body: `Your verification code is: ${code}. Valid for ${this.OTP_EXPIRY_MINUTES} minutes.`
    // });
  }

  /**
   * Send OTP code to phone number
   */
  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
    const { phoneNumber, purpose } = dto;

    // Invalidate any existing unverified OTPs for this phone number
    await this.otpRepository.update(
      {
        phoneNumber,
        isVerified: false,
      },
      {
        isVerified: true, // Mark as used
      },
    );

    // Generate new OTP code
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Save OTP to database
    const otpCode = this.otpRepository.create({
      phoneNumber,
      code,
      expiresAt,
      purpose: purpose || 'verification',
      attempts: 0,
      isVerified: false,
    });

    await this.otpRepository.save(otpCode);

    // Send via WhatsApp
    try {
      await this.sendWhatsAppMessage(phoneNumber, code);
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      throw new BadRequestException('Failed to send OTP. Please try again.');
    }

    return {
      message: 'OTP sent successfully via WhatsApp',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60, // in seconds
    };
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ verified: boolean; message: string }> {
    const { phoneNumber, code } = dto;

    // Find the most recent unverified OTP for this phone number
    const otpCode = await this.otpRepository.findOne({
      where: {
        phoneNumber,
        isVerified: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!otpCode) {
      throw new NotFoundException('No active OTP found for this phone number');
    }

    // Check if OTP has expired
    if (new Date() > otpCode.expiresAt) {
      throw new BadRequestException('OTP code has expired. Please request a new one.');
    }

    // Check if max attempts exceeded
    if (otpCode.attempts >= this.MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
    }

    // Verify the code
    if (otpCode.code !== code) {
      otpCode.attempts += 1;
      await this.otpRepository.save(otpCode);

      const remainingAttempts = this.MAX_ATTEMPTS - otpCode.attempts;
      throw new BadRequestException(
        `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
      );
    }

    // Mark as verified
    otpCode.isVerified = true;
    await this.otpRepository.save(otpCode);

    return {
      verified: true,
      message: 'OTP verified successfully',
    };
  }

  /**
   * Clean up expired OTPs (can be called by a cron job)
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.otpRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  /**
   * Check if phone number has a valid unverified OTP
   */
  async hasActiveOtp(phoneNumber: string): Promise<boolean> {
    const otp = await this.otpRepository.findOne({
      where: {
        phoneNumber,
        isVerified: false,
        expiresAt: LessThan(new Date()),
      },
    });
    return !!otp;
  }
}

