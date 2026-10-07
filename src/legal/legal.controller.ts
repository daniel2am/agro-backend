import { Controller, Get, Header } from '@nestjs/common';
import { paginaPrivacidade, paginaTermos } from './legal.paginas';

// Páginas públicas exigidas pelas lojas de aplicativos (URL de privacidade e termos).
@Controller()
export class LegalController {
  @Get('privacidade')
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacidade() {
    return paginaPrivacidade();
  }

  @Get('termos')
  @Header('Content-Type', 'text/html; charset=utf-8')
  termos() {
    return paginaTermos();
  }
}
