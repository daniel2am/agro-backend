import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Logger, Post, Query, RawBodyRequest, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { WhatsappService } from './whatsapp.service';
import { assinaturaValida, extrairMensagens } from './whatsapp.webhook';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly service: WhatsappService) {}

  /** Handshake de verificação do webhook (a Meta chama uma vez ao cadastrar a URL). */
  @Get('webhook')
  verificar(@Query('hub.mode') modo: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') desafio: string) {
    const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
    if (modo === 'subscribe' && esperado && token === esperado) return desafio;
    throw new ForbiddenException();
  }

  /**
   * Mensagens recebidas. A assinatura HMAC é obrigatória: sem WHATSAPP_APP_SECRET o webhook
   * recusa tudo. Responde 200 logo e processa em seguida (a Meta reenvia se demorarmos).
   */
  @Post('webhook')
  @HttpCode(200)
  receber(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') assinatura: string | undefined, @Body() corpo: unknown) {
    const segredo = process.env.WHATSAPP_APP_SECRET;
    if (!segredo) throw new ServiceUnavailableException('WhatsApp não configurado');
    if (!assinaturaValida(req.rawBody, assinatura, segredo)) {
      this.logger.warn(`Webhook recusado: assinatura ${assinatura ? 'não confere (confira WHATSAPP_APP_SECRET)' : 'ausente'}`);
      throw new ForbiddenException('Assinatura inválida');
    }

    const mensagens = extrairMensagens(corpo);
    this.logger.log(`Webhook recebido: ${mensagens.length} mensagem(ns) de usuário`);
    for (const m of mensagens) {
      this.service.processar(m).catch((e) => this.logger.error(`Erro no processamento: ${(e as Error).message}`));
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------- app (autenticado)

  @UseGuards(JwtAuthGuard)
  @Get()
  situacao(@AuthUser() user: UsuarioPayload) {
    return this.service.situacao(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('vincular')
  vincular(@AuthUser() user: UsuarioPayload) {
    return this.service.gerarCodigo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  desvincular(@AuthUser() user: UsuarioPayload) {
    return this.service.desvincular(user.id);
  }
}
