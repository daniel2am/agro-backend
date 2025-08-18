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

  // Google OAuth via Passport (fluxo web)
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {
    // Passport redireciona para o Google
  }

  @UseGuards(GoogleAuthGuard)
@Get('google/redirect')
async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
  const data = await this.authService.googleLogin((req as any).user);

  const token = data?.token;
  const state = (req.query?.state as string) || ''; // ← vem de /auth/google?state=mobile

  // se veio do app (WebBrowser.openAuthSessionAsync)
  if (state === 'mobile') {
    const scheme = process.env.APP_SCHEME || 'agrototal'; // defina APP_SCHEME=agrototal no .env
    if (token) return res.redirect(`${scheme}://auth/success?token=${token}`);
    return res.redirect(`${scheme}://auth/error`);
  }

  // fluxo web (mantém como estava)
  if (token) {
    return res.redirect(`https://www.agrototalapp.com.br/auth/success?token=${token}`);
  }
  return res.redirect('https://www.agrototalapp.com.br/auth/error');
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