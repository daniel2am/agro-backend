import {
  Controller, Get, Post, Body, Patch, Param, Delete, Res
} from '@nestjs/common';
import { CompraInsumoService } from './compra-insumo.service';
import { CreateCompraInsumoDto } from './dto/create-compra.dto';
import { UpdateCompraInsumoDto } from './dto/update-compra.dto';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { Response } from 'express';

@Controller('compra-insumo')
export class CompraInsumoController {
  constructor(private readonly service: CompraInsumoService) {}

  @Post()
  create(@Body() dto: CreateCompraInsumoDto, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload) {
    return this.service.findAll(user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompraInsumoDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user);
  }

  @Get('/export/csv')
  async exportCSV(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const csv = await this.service.exportCSV(user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=compras.csv');
    res.send(csv);
  }

  @Get('/export/pdf')
  async exportPDF(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const doc = await this.service.exportPDF(user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=compras.pdf');
    doc.pipe(res);
    doc.end();
  }
}
