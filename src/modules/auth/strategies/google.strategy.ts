import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['profile', 'email'],
    });
  }

  // O retorno daqui vira req.user nos controllers/guards que usam 'google'
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    // dados mínimos para o AuthService.googleLogin
    const email = profile.emails?.[0]?.value;
    const nome = profile.displayName;
    const sub = profile.id; // googleId

    const payload = {
      email,
      nome,
      sub,
      // opcional: picture: profile.photos?.[0]?.value,
      // opcional: accessToken, refreshToken
    };

    done(null, payload);
  }
}