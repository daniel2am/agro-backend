import { Controller, Get, Param, Patch, Body, Delete, UseGuards, Req } from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('usuario')
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req) {
    return this.usuarioService.findOne(req.user.sub);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usuarioService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.usuarioService.update(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usuarioService.remove(id);
  }
}
