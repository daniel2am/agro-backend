import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  private async assertSelfOrAdmin(id: string, user: UsuarioPayload) {
    if (id === user.id) return;
    const solicitante = await this.usuarioService.findOne(user.id);
    if (solicitante?.tipo === 'administrador') return;
    throw new ForbiddenException('Acesso negado');
  }

  // Criação de usuário é feita via /auth/register (fluxo público de cadastro).
  // Este endpoint fica autenticado para uso administrativo futuro.
  @Post()
  async create(@Body() dto: CreateUsuarioDto) {
    const { senha: _omit, ...safeUser } = (await this.usuarioService.create(dto)) as any;
    return safeUser;
  }

  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    await this.assertSelfOrAdmin(id, user);
    return this.usuarioService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUsuarioDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    await this.assertSelfOrAdmin(id, user);
    return this.usuarioService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    await this.assertSelfOrAdmin(id, user);
    return this.usuarioService.remove(id);
  }
}
