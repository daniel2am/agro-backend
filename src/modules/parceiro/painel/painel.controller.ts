import { Controller, Get, Header } from '@nestjs/common';
import { paginaPainel, scriptPainel } from './painel.paginas';

/** Painel web do parceiro: página estática; os dados vêm da API autenticada (/parceiros/*). */
@Controller('painel-parceiro')
export class PainelParceiroController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  pagina() {
    return paginaPainel();
  }

  @Get('app.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  script() {
    return scriptPainel();
  }
}
