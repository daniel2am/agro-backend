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
import { PesagemService } from './pesagem.service';
  import { CreatePesagemDto } from './dto/create-pesagem.dto';
import { UpdatePesagemDto } from './dto/update-pesagem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('pesagens')
export class PesagemController {
  constructor(private readonly pesagemService: PesagemService) {}

  @Post()
  create(@Body() dto: CreatePesagemDto, @Req() req: Request) {
    const usuarioId = (req.user as any).sub;
    return this.pesagemService.create(dto, usuarioId);
  }

  @Get()
  findAll(@Query() query: any, @Req() req: Request) {
    const usuarioId = (req.user as any).sub;
    return this.pesagemService.findAll(usuarioId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = (req.user as any).sub;
    return this.pesagemService.findOne(id, usuarioId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePesagemDto, @Req() req: Request) {
    const usuarioId = (req.user as any).sub;
    return this.pesagemService.update(id, dto, usuarioId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const usuarioId = (req.user as any).sub;
    return this.pesagemService.remove(id, usuarioId);
  }
}