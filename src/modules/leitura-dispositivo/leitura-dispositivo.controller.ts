import { Controller, Post, Get, Body, Param, Delete } from '@nestjs/common';
import { LeituraDispositivoService } from './leitura-dispositivo.service';
import { CreateLeituraDispositivoDto } from './dto/create-leitura-dispositivo.dto';

@Controller('leituras')
export class LeituraDispositivoController {
  constructor(private readonly service: LeituraDispositivoService) {}

  @Post()
  create(@Body() dto: CreateLeituraDispositivoDto) {
    return this.service.create(dto);
  }

  @Get('fazenda/:fazendaId')
  findAllByFazenda(@Param('fazendaId') fazendaId: string) {
    return this.service.findAllByFazenda(fazendaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}