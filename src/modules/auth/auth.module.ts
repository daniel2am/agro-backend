import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UsuarioModule } from '../usuario/usuario.module';
import { MailerService } from 'src/common/mailer/mailer.service';

@Module({
  imports: [
    UsuarioModule,
    PassportModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy, GoogleStrategy, MailerService],
  controllers: [AuthController],
})
export class AuthModule {}
