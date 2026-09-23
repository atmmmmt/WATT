import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class ForgotPasswordDto {
  @ApiProperty() @IsEmail() email: string;
}

class ResetPasswordDto {
  @ApiProperty() @IsString() token: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login to the dashboard' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current dashboard user' })
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token from email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('set-password')
  @ApiOperation({ summary: 'Set password from invite token' })
  setInvitePassword(@Body() dto: ResetPasswordDto) {
    return this.authService.setInvitePassword(dto.token, dto.password);
  }

  @Get('verify-token')
  @ApiOperation({ summary: 'Verify invite or reset token validity' })
  verifyToken(
    @Query('token') token: string,
    @Query('type') type: 'invite' | 'reset',
  ) {
    return this.authService.verifyToken(token, type);
  }
}
