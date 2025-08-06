import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { InvernadaService } from './invernada.service';
import { CreateInvernadaDto } from './dto/create-invernada.dto';
import { UpdateInvernadaDto } from './dto/update-invernada.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('invernadas')
export class InvernadaController {
  constructor(private readonly invernadaService: InvernadaService) {}

  @Post()
  create(@Body() dto: CreateInvernadaDto) {
    return this.invernadaService.create(dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.invernadaService.findAllByUsuario(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.invernadaService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvernadaDto, @Req() req) {
    return this.invernadaService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.invernadaService.remove(id, req.user.id);
  }
}