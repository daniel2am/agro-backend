// src/modules/usuario/usuario.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcryptjs';
import { Prisma, TipoUsuario } from '@prisma/client';

@Injectable()
export class UsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUsuarioDto) {
    const senhaHash = await bcrypt.hash(data.senha, 10);
    return this.prisma.usuario.create({
      data: {
        ...data,
        senha: senhaHash,
      },
    });
  }

  async findAll() {
    return this.prisma.usuario.findMany();
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
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

    return this.prisma.usuario.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    return this.prisma.usuario.delete({ where: { id } });
  }
}