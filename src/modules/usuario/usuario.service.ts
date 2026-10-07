// src/modules/usuario/usuario.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcryptjs';
import { Prisma, TipoUsuario } from '@prisma/client';
import { PlanoService } from '../plano/plano.service';
import { EquipeService } from '../equipe/equipe.service';

const SAFE_SELECT = {
  id: true,
  nome: true,
  email: true,
  fotoUrl: true,
  status: true,
  tipo: true,
  criadoEm: true,
  atualizadoEm: true,
  ultimoLogin: true,
  termosAceitosEm: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipe: EquipeService,
  ) {}

  // Retorna o registro completo (incluindo hash da senha) porque o AuthService
  // precisa dele internamente (ex.: comparar/atualizar appleId). Quem expõe
  // isso a um cliente HTTP deve remover o campo `senha` antes de responder.
  async create(data: CreateUsuarioDto) {
    const senhaHash = await bcrypt.hash(data.senha, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        ...data,
        senha: senhaHash,
        // teste gratuito do plano completo (TRIAL_DIAS; 0 desliga)
        ...PlanoService.dadosDoTeste(),
      },
    });

    // quem foi convidado para uma fazenda antes de ter conta entra nela agora
    try {
      await this.equipe.aceitarConvitesPendentes(usuario.id, usuario.email);
    } catch {
      // não derruba o cadastro: o convite continua pendente e vale no próximo acesso
    }
    return usuario;
  }

  async findAll() {
    return this.prisma.usuario.findMany({ select: SAFE_SELECT });
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: SAFE_SELECT,
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async findByEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  async findByAppleId(appleId: string) {
    return this.prisma.usuario.findUnique({ where: { appleId } });
  }

  async findByResetToken(token: string) {
    return this.prisma.usuario.findFirst({ where: { resetToken: token } });
  }

  async update(
    id: string,
    data: Prisma.UsuarioUpdateInput | (Partial<UpdateUsuarioDto> & Record<string, any>),
  ) {
    const patch: Prisma.UsuarioUpdateInput = { ...data };

    if (typeof (patch as any).senha === 'string' && (patch as any).senha.length > 0) {
      (patch as any).senha = await bcrypt.hash((patch as any).senha, 10);
    }

    const toDate = (v: unknown) => (typeof v === 'string' ? new Date(v) : (v as any));
    if ((patch as any).resetTokenExpires) (patch as any).resetTokenExpires = toDate((patch as any).resetTokenExpires);
    if ((patch as any).termosAceitosEm)   (patch as any).termosAceitosEm   = toDate((patch as any).termosAceitosEm);
    if ((patch as any).ultimoLogin)       (patch as any).ultimoLogin       = toDate((patch as any).ultimoLogin);

    if ((patch as any).tipo !== undefined) {
      const raw = (patch as any).tipo;
      if (typeof raw === 'string') {
        const norm = raw.toLowerCase();
        if (norm === 'usuario' || norm === 'administrador' || norm === 'gestor') {
          (patch as any).tipo = norm as TipoUsuario;
        } else {
          delete (patch as any).tipo;
        }
      }
    }

    return this.prisma.usuario.update({ where: { id }, data: patch, select: SAFE_SELECT });
  }

  async remove(id: string) {
    return this.prisma.usuario.delete({ where: { id }, select: SAFE_SELECT });
  }
}