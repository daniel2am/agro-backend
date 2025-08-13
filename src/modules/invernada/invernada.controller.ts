// src/modules/invernada/invernada.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InvernadaService } from './invernada.service';
import { CreateInvernadaDto } from './dto/create-invernada.dto';
import { UpdateInvernadaDto } from './dto/update-invernada.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('invernadas')
export class InvernadaController {
  constructor(private readonly invernadaService: InvernadaService) {}

  @Post()
  create(@Body() dto: CreateInvernadaDto, @Req() req: Request) {
    return this.invernadaService.create(dto, req.user['sub']);
  }

  @Get()
  findAll(@Req() req: Request, @Query('fazendaId') fazendaId?: string) {
    if (fazendaId) {
      return this.invernadaService.findAllByFazenda(fazendaId);
    }
    return this.invernadaService.findAllByUsuario(req.user['sub'], fazendaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.invernadaService.findOne(id, req.user['sub']);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvernadaDto, @Req() req: Request) {
    return this.invernadaService.update(id, dto, req.user['sub']);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.invernadaService.remove(id, req.user['sub']);
  }
}