import { Body, Controller, Get, Headers, HttpCode, NotFoundException, Patch, UnauthorizedException, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { IsDateString, IsEmail, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { PlanoService } from './plano.service';
import { PLANOS, PlanoTipo } from './planos';

@Controller('plano')
@UseGuards(JwtAuthGuard)
export class PlanoController {
  constructor(private readonly planos: PlanoService) {}

  /** Plano em vigor, uso, limites e o catálogo de planos para a tela de upgrade. */
  @Get()
  resumo(@AuthUser() user: UsuarioPayload) {
    return this.planos.resumo(user.id);
  }
}

class DefinirPlanoDto {
  @IsEmail()
  email: string;

  @IsIn(PLANOS as unknown as string[])
  plano: PlanoTipo;

  /** ISO; omitido = sem vencimento. */
  @IsOptional()
  @IsDateString()
  ateEm?: string;
}

/** Comparação em tempo constante, para não vazar a chave por diferença de tempo. */
export function chaveConfere(recebida: string | undefined, esperada: string | undefined): boolean {
  if (!esperada || !recebida) return false;
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Troca o plano de um usuário. Serve para liberar contas manualmente enquanto a
 * cobrança não está integrada (e, depois, para o webhook do meio de pagamento).
 * Desligado por padrão: só existe se ADMIN_API_KEY estiver definida no servidor.
 */
@Controller('admin/plano')
export class AdminPlanoController {
  constructor(private readonly planos: PlanoService) {}

  @Patch()
  @HttpCode(200)
  async definir(@Headers('x-admin-key') chave: string | undefined, @Body() dto: DefinirPlanoDto) {
    if (!process.env.ADMIN_API_KEY) throw new NotFoundException();
    if (!chaveConfere(chave, process.env.ADMIN_API_KEY)) throw new UnauthorizedException('Chave inválida');
    return this.planos.definirPlano(dto.email, dto.plano, dto.ateEm ? new Date(dto.ateEm) : null);
  }
}
