import { Test } from '@nestjs/testing';
import request from 'supertest';
import helmet from 'helmet';
import { PainelParceiroController } from './painel.controller';
import { paginaPainel, scriptPainel } from './painel.paginas';

describe('painel do parceiro', () => {
  let app: any;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [PainelParceiroController] }).compile();
    app = mod.createNestApplication();
    app.use(helmet()); // o mesmo helmet do main.ts
    await app.init();
  });
  afterAll(() => app.close());

  it('serve a página e o script com os tipos certos', async () => {
    const p = await request(app.getHttpServer()).get('/painel-parceiro');
    expect(p.status).toBe(200);
    expect(p.headers['content-type']).toMatch(/text\/html/);
    expect(p.text).toContain('/painel-parceiro/app.js');
    const j = await request(app.getHttpServer()).get('/painel-parceiro/app.js');
    expect(j.status).toBe(200);
    expect(j.headers['content-type']).toMatch(/javascript/);
  });

  it('é compatível com o CSP do helmet: sem script nem handler inline', async () => {
    const p = await request(app.getHttpServer()).get('/painel-parceiro');
    const csp = String(p.headers['content-security-policy']);
    expect(csp).toContain("script-src 'self'");
    const html = paginaPainel();
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/i); // todo <script> tem src
    expect(html).not.toMatch(/\son[a-z]+\s*=/i); // sem onclick= etc.
  });

  it('o script é JS válido e nunca injeta HTML (dados de terceiros)', () => {
    const js = scriptPainel();
    expect(() => new Function(js)).not.toThrow();
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
  });
});
