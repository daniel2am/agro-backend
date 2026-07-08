// src/common/tenant/tenant.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.tenantId) throw new ForbiddenException('Tenant ausente');
    return true;
  }
}

// src/common/tenant/tenant.prisma.ts
export function withTenant<T extends object>(tenantId: string, where: T) {
  return { ...where, fazenda: { some: { id: tenantId } } } as any;
}