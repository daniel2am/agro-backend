import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FazendaService } from './fazenda.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('fazenda')
@UseGuards(JwtAuthGuard)
export class FazendaController {
  constructor(private readonly fazendaService: FazendaService) {}

  @Post()
  create(@Body() dto: CreateFazendaDto, @Req() req: Request) {
    return this.fazendaService.create(dto, req.user['sub']);
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: any) {
    return this.fazendaService.findAll(req.user['sub'], query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.fazendaService.findOne(id, req.user['sub']);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFazendaDto, @Req() req: Request) {
    return this.fazendaService.update(id, dto, req.user['sub']);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.fazendaService.remove(id, req.user['sub']);
  }
}