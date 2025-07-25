import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { LavouraService } from './lavoura.service';
import { CreateLavouraDto, UpdateLavouraDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('lavoura')
@UseGuards(JwtAuthGuard)
export class LavouraController {
  constructor(private readonly lavouraService: LavouraService) {}

  @Post()
  create(@Body() dto: CreateLavouraDto, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.lavouraService.create(dto, usuarioId);
  }

  @Get()
  findAll(@Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.lavouraService.findAll(usuarioId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.lavouraService.findOne(id, usuarioId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLavouraDto, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.lavouraService.update(id, dto, usuarioId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.lavouraService.remove(id, usuarioId);
  }
}
