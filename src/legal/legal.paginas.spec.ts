import { dadosEmpresa, paginaPrivacidade, paginaTermos } from './legal.paginas';

describe('páginas legais', () => {
  it('privacidade cita LGPD, exclusão de conta e o contato configurado', () => {
    const html = paginaPrivacidade({ nome: 'Agro Ltda', cnpj: '12.345.678/0001-90', email: 'privacidade@agro.com' });
    expect(html).toContain('LGPD');
    expect(html).toContain('Excluir minha conta');
    expect(html).toContain('privacidade@agro.com');
    expect(html).toContain('12.345.678/0001-90');
  });

  it('sem LEGAL_* configurado não quebra nem mostra "undefined"', () => {
    const e = dadosEmpresa({} as any);
    expect(paginaPrivacidade(e)).not.toMatch(/undefined|null/);
    expect(paginaTermos(e)).not.toMatch(/undefined|null/);
  });

  it('escapa HTML vindo da configuração', () => {
    const html = paginaTermos({ nome: '<script>x</script>', cnpj: '', email: '' });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('termos avisam que o conteúdo agronômico/veterinário é apoio', () => {
    expect(paginaTermos()).toMatch(/engenheiro agrônomo/);
  });
});
