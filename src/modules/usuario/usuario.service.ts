import { Injectable, NotFoundException } from '@nestjs/common';
// Update the path below to the correct location of prisma.service.ts
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { nome: string; email: string; senha: string }) {
    return this.prisma.usuario.create({ data });
  }

  async findByEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  async findByResetToken(token: string) {
    return this.prisma.usuario.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() }
      }
    });
  }

  async update(id: string, data: any) {
    if (data.senha) {
      data.senha = await bcrypt.hash(data.senha, 10);
    }
    return this.prisma.usuario.update({ where: { id }, data });
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    const { senha, ...rest } = usuario;
    return rest;
  }

  async remove(id: string) {
    return this.prisma.usuario.delete({ where: { id } });
  }
}
