import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req
} from '@nestjs/common';
import { SanidadeService } from './sanidade.service';
import { CreateSanidadeDto } from './dto/create-sanidade.dto';
import { UpdateSanidadeDto } from './dto/update-sanidade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('sanidade')
export class SanidadeController {
  constructor(private readonly sanidadeService: SanidadeService) {}

  @Post()
  create(@Body() dto: CreateSanidadeDto, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.sanidadeService.create(dto, usuarioId);
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: any) {
    const usuarioId = req.user['sub'];
    return this.sanidadeService.findAll(usuarioId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.sanidadeService.findOne(id, usuarioId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSanidadeDto, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.sanidadeService.update(id, dto, usuarioId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = req.user['sub'];
    return this.sanidadeService.remove(id, usuarioId);
  }
}
