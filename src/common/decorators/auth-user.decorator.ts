import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioPayload } from '../../modules/auth/dto/usuario-payload.interface';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UsuarioPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
