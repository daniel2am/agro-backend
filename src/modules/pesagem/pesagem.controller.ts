import {
  Controller, Post, Body, Get, Param, Delete, UseGuards, Put, Res
} from '@nestjs/common';
import { PesagemService } from './pesagem.service';
import { CreatePesagemDto } from './dto/create-pesagem.dto';
import { UpdatePesagemDto } from './dto/update-pesagem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from 'src/modules/auth/dto/usuario-payload.interface';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('pesagens')
export class PesagemController {
  constructor(private readonly pesagemService: PesagemService) {}

  @Post()
  create(@Body() dto: CreatePesagemDto, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.create(dto, user);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload) {
    return this.pesagemService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePesagemDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.pesagemService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.remove(id, user);
  }

  @Get('/export/csv')
async exportCSV(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
  const csv = await this.pesagemService.exportCSV(user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=pesagens.csv');
  res.send(csv);
}


  @Get('/export/pdf')
  async exportPDF(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const doc = await this.pesagemService.exportPDF(user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=pesagens.pdf');
    doc.pipe(res);
    doc.end();
  }
}
