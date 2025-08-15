// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { ForgotPasswordDto, ResetPasswordDto, RegisterAuthDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Email/senha
  @Post('register')
  async register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request) {
    return this.authService.login((req as any).user);
  }

  // OAuth Web – Google (Passport)
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {}

  @UseGuards(GoogleAuthGuard)
  @Get('google/redirect')
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const data = await this.authService.googleLogin((req as any).user);
    if (data?.token) {
      return res.redirect(`https://www.agrototalapp.com.br/auth/success?token=${data.token}`);
    }
    return res.redirect('https://www.agrototalapp.com.br/auth/error');
  }

  // OAuth Mobile – Google (ID Token vindo do app)
  @Post('google/token')
  async googleToken(@Body() body: { idToken: string }) {
    return this.authService.loginOrRegisterWithGoogleIdToken(body.idToken);
  }

  // OAuth Mobile – Apple (Identity Token vindo do app)
  @Post('apple/token')
  async appleToken(@Body() body: { identityToken: string }) {
    return this.authService.loginOrRegisterWithAppleIdToken(body.identityToken);
  }

  // Esqueci / Reset
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}