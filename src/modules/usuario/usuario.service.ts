import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcryptjs';

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

  async update(id: string, data: Partial<UpdateUsuarioDto> & Record<string, any>) {
    if (data.senha) {
      data.senha = await bcrypt.hash(data.senha, 10);
    }
    return this.prisma.usuario.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.usuario.delete({ where: { id } });
  }
}
