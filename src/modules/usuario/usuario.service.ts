// src/modules/usuario/usuario.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcrypt';

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

  async findByResetToken(token: string) {
    return this.prisma.usuario.findFirst({ where: { resetToken: token } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.usuario.findFirst({ where: { googleId } });
  }

  async findByAppleId(appleId: string) {
    return this.prisma.usuario.findFirst({ where: { appleId } });
  }

  async update(id: string, data: Partial<UpdateUsuarioDto>) {
    const toUpdate: any = { ...data };
    if (data.senha) {
      toUpdate.senha = await bcrypt.hash(data.senha, 10);
    }
    // Se vier string em ultimoLogin, converte pra Date
    if (typeof (data as any)?.ultimoLogin === 'string') {
      const d = new Date((data as any).ultimoLogin);
      if (!Number.isNaN(d.getTime())) toUpdate.ultimoLogin = d;
    }
    return this.prisma.usuario.update({ where: { id }, data: toUpdate });
  }

  async remove(id: string) {
    return this.prisma.usuario.delete({ where: { id } });
  }
}