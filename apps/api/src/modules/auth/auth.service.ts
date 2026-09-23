import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';
import { LoginDto } from './dto/login.dto';
import { Tenant } from '../tenants/schemas/tenant.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sanitizedUser = this.usersService.sanitizeUser(user.toObject());
    if (sanitizedUser.id) {
      await this.usersService.recordLogin(sanitizedUser.id);
    }
    const payload = {
      sub: sanitizedUser.id,
      email: sanitizedUser.email,
      role: sanitizedUser.role,
      tenantId: sanitizedUser.tenantId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: sanitizedUser,
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    if (user.tenantId) {
      const tenant = await this.tenantModel.findById(user.tenantId).lean();
      return { ...user, enabledProducts: tenant?.enabledProducts ?? [] };
    }
    return user;
  }

  async forgotPassword(email: string) {
    const dashboardOrigin = this.configService.get<string>('dashboardOrigin') || '';
    const result = await this.usersService.generateResetToken(email);
    if (result) {
      const resetUrl = `${dashboardOrigin}/reset-password?token=${result.resetToken}`;
      await this.mailerService.sendPasswordReset({
        to: result.user.email,
        name: result.user.name,
        resetUrl,
      });
    }
    // Always return success to prevent email enumeration
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }
    await this.usersService.setPasswordByToken(token, newPassword, 'reset');
    return { success: true };
  }

  async setInvitePassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }
    const user = await this.usersService.setPasswordByToken(token, newPassword, 'invite');
    return { success: true, email: user.email };
  }

  async verifyToken(token: string, type: 'invite' | 'reset') {
    const user =
      type === 'invite'
        ? await this.usersService.findByInviteToken(token)
        : await this.usersService.findByResetToken(token);
    if (!user) throw new BadRequestException('الرابط غير صالح أو منتهي الصلاحية');
    return { valid: true, email: user.email, name: user.name };
  }
}
