import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { registrarErro } from './sentry';

/**
 * Mantém a resposta padrão do Nest, mas registra todo erro de servidor (5xx e
 * exceções inesperadas) no log e no Sentry. Erros 4xx são do cliente e ficam de fora.
 */
@Catch()
export class ErrosFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Erro');

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      const req = host.switchToHttp().getRequest?.() ?? {};
      // rota sem ids/query: não leva dados do usuário para o log
      const rota = String(req.route?.path ?? req.url ?? '').split('?')[0];
      this.logger.error(
        `${req.method ?? '?'} ${rota} → ${status}: ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
      registrarErro(exception, { metodo: String(req.method ?? ''), rota });
    }
    super.catch(exception, host);
  }
}
