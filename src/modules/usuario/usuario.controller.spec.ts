import { ForbiddenException } from '@nestjs/common';
import { UsuarioController } from './usuario.controller';

describe('UsuarioController — perfil e exclusão', () => {
  let service: any;
  let ctrl: UsuarioController;
  const eu: any = { id: '11111111-1111-4111-8111-111111111111' };
  const outro = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    service = {
      findOne: jest.fn().mockResolvedValue({ tipo: 'usuario' }),
      update: jest.fn().mockResolvedValue({}),
      loginSocial: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue({}),
      excluirConta: jest.fn().mockResolvedValue({ removido: true }),
    };
    ctrl = new UsuarioController(service);
  });

  it('usuário comum NÃO consegue se promover a administrador nem mudar status/ids sociais', async () => {
    await ctrl.update(eu.id, { nome: 'Novo', tipo: 'administrador', status: 'ativo', googleId: 'x', resetToken: 'y' } as any, eu);
    expect(service.update).toHaveBeenCalledWith(eu.id, { nome: 'Novo' });
  });

  it('administrador global pode editar o tipo de outra conta', async () => {
    service.findOne.mockResolvedValue({ tipo: 'administrador' });
    await ctrl.update(outro, { tipo: 'gestor' } as any, eu);
    expect(service.update).toHaveBeenCalledWith(outro, { tipo: 'gestor' });
  });

  it('não edita a conta de outra pessoa', async () => {
    await expect(ctrl.update(outro, { nome: 'x' } as any, eu)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('DELETE /usuarios/:id não serve para apagar a própria conta (sem conferir senha)', async () => {
    await expect(ctrl.remove(eu.id, eu)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.remove).not.toHaveBeenCalled();
  });

  it('o próprio usuário recebe loginSocial ao consultar o perfil', async () => {
    service.findOne.mockResolvedValue({ id: eu.id, nome: 'A' });
    await expect(ctrl.findOne(eu.id, eu)).resolves.toEqual({ id: eu.id, nome: 'A', loginSocial: true });
  });

  it('DELETE /usuarios/me passa a senha para o service', async () => {
    await ctrl.excluirMinhaConta({ senha: 'abc' }, eu);
    expect(service.excluirConta).toHaveBeenCalledWith(eu.id, 'abc');
  });
});
