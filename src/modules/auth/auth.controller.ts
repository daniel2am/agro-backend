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

  // Registro por e-mail/senha
  @Post('register')
  async register(@Body() dto: RegisterAuthDto) {
    return this.authService.register(dto);
  }

  // Login por e-mail/senha (LocalStrategy -> validateUser)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request) {
    return this.authService.login((req as any).user);
  }

  // Google OAuth via Passport (fluxo web e mobile com ?state=mobile)
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {}

  @UseGuards(GoogleAuthGuard)
  @Get('google/redirect')
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.authService.googleLogin((req as any).user);
      const token = data?.token;
      const state = (req.query?.state as string) || '';

      // fluxo mobile: volta para o app via scheme
      if (state === 'mobile') {
        const scheme = process.env.APP_SCHEME || 'agrototal';
        if (token) return res.redirect(`${scheme}://auth/success?token=${encodeURIComponent(token)}`);
        return res.redirect(`${scheme}://auth/error`);
      }

      // fluxo web
      if (token) {
        return res.redirect(`https://www.agrototalapp.com.br/auth/success?token=${encodeURIComponent(token)}`);
      }
      return res.redirect('https://www.agrototalapp.com.br/auth/error');
    } catch {
      const state = (req.query?.state as string) || '';
      const scheme = process.env.APP_SCHEME || 'agrototal';
      const errorTarget = state === 'mobile' ? `${scheme}://auth/error` : 'https://www.agrototalapp.com.br/auth/error';
      return res.redirect(errorTarget);
    }
  }

  // Apple (mobile) – recebe identityToken do app
  @Post('apple/token')
  async appleToken(@Body() body: { identityToken: string }) {
    return this.authService.loginOrRegisterWithAppleIdToken(body.identityToken);
  }

  // Esqueci / Reset de senha
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}