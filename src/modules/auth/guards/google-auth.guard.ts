import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // Garante que o "state" que veio na sua rota /auth/google?state=mobile
  // seja repassado para o Google e volte no callback.
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const state = (req.query?.state as string) || undefined;
    return {
      scope: ['email', 'profile'],
      accessType: 'offline',
      prompt: 'consent',
      state, // ⬅️ crucial
    };
  }
}