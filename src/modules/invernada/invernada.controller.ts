// src/modules/invernada/invernada.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InvernadaService } from './invernada.service';
import { CreateInvernadaDto } from './dto/create-invernada.dto';
import { UpdateInvernadaDto } from './dto/update-invernada.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('invernadas')
export class InvernadaController {
  constructor(private readonly invernadaService: InvernadaService) {}

  @Post()
  create(@Body() dto: CreateInvernadaDto, @AuthUser() user: UsuarioPayload) {
    return this.invernadaService.create(dto, user.id);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload, @Query('fazendaId') fazendaId?: string) {
    if (fazendaId) {
      return this.invernadaService.findAllByFazenda(fazendaId, user.id);
    }
    return this.invernadaService.findAllByUsuario(user.id, fazendaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.invernadaService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvernadaDto, @AuthUser() user: UsuarioPayload) {
    return this.invernadaService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.invernadaService.remove(id, user.id);
  }
}
