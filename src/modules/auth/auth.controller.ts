import { Controller, Post, Body, Get, Req, Res, UseGuards, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Request, Response } from 'express';
import { CreateUserDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Removed duplicate googleAuth and googleAuthRedirect methods

  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(req.user);
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {}

  @UseGuards(GoogleAuthGuard)
  @Get('google/redirect')
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const data = await this.authService.googleLogin(req.user);
    if (data && data.token) {
      // Redireciona para o frontend já autenticado
      return res.redirect(`https://www.agrototalapp.com.br/auth/success?token=${data.token}`);
    }
    return res.redirect('https://www.agrototalapp.com.br/auth/error');
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
