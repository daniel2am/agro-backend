// src/modules/animal/animal.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AnimalService } from './animal.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('animais')
export class AnimalController {
  constructor(private readonly service: AnimalService) {}

  @Post()
  create(@Body() dto: CreateAnimalDto, @AuthUser() user: UsuarioPayload) {
    // cria animal + pesagem inicial (se vier peso) no service
    return this.service.create(dto, user.id);
  }

  // ⚠️ Rotas estáticas antes da rota dinâmica :id para evitar colisão
  @Get('export/csv')
  async exportCSV(@Res() res: Response, @AuthUser() user: UsuarioPayload) {
    const { buffer, filename } = await this.service.exportCSV(user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPDF(@Res() res: Response, @AuthUser() user: UsuarioPayload) {
    const { buffer, filename } = await this.service.exportPDF(user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  }

  @Get()
  findAll(@Query() query: any, @AuthUser() user: UsuarioPayload) {
    // suporta search, paginação, etc. no service
    return this.service.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAnimalDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    // atualiza animal e, se vier peso, registra Pesagem também no service
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user.id);
  }
}