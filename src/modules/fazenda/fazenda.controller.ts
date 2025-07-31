import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { FazendaService } from './fazenda.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@Controller('fazenda')
@UseGuards(JwtAuthGuard)
export class FazendaController {
  constructor(private readonly fazendaService: FazendaService) {}

  @Post()
  create(@Body() dto: CreateFazendaDto, @AuthUser() user: UsuarioPayload) {
    return this.fazendaService.create(dto, user.id); // <-- pega o ID do usuário
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload, @Query() query: any) {
    return this.fazendaService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.fazendaService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFazendaDto, @AuthUser() user: UsuarioPayload) {
    return this.fazendaService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.fazendaService.remove(id, user.id);
  }
}
