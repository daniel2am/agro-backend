import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req
} from '@nestjs/common';
import { SanidadeService } from './sanidade.service';
import { CreateSanidadeDto } from './dto/create-sanidade.dto';
import { UpdateSanidadeDto } from './dto/update-sanidade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

type ListQuery = {
  take?: string;
  skip?: string;
  search?: string;
};

@UseGuards(JwtAuthGuard)
@Controller('sanidade')
export class SanidadeController {
  constructor(private readonly sanidadeService: SanidadeService) {}

  private getUserId(req: Request) {
    return (req.user as any)?.sub as string;
  }

  @Post()
  create(@Body() dto: CreateSanidadeDto, @Req() req: Request) {
    const usuarioId = this.getUserId(req);
    return this.sanidadeService.create(dto, usuarioId);
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: ListQuery) {
    const usuarioId = this.getUserId(req);
    return this.sanidadeService.findAll(usuarioId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = this.getUserId(req);
    return this.sanidadeService.findOne(id, usuarioId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSanidadeDto, @Req() req: Request) {
    const usuarioId = this.getUserId(req);
    return this.sanidadeService.update(id, dto, usuarioId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = this.getUserId(req);
    return this.sanidadeService.remove(id, usuarioId);
  }
}