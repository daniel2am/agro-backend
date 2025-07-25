import { Controller, Post, Get, Body } from '@nestjs/common';
import { MarcaModeloService } from './marca-modelo.service';
import { CreateMarcaModeloDto } from './dto/create-marca-modelo.dto';

@Controller('modelos-dispositivo')
export class MarcaModeloController {
  constructor(private readonly service: MarcaModeloService) {}

  @Post()
  create(@Body() dto: CreateMarcaModeloDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }
}