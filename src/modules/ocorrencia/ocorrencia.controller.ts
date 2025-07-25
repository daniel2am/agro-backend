import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Res,
} from '@nestjs/common';
import { OcorrenciaService } from './ocorrencia.service';
import { CreateOcorrenciaDto } from './dto/create-ocorrencia.dto';
import { UpdateOcorrenciaDto } from './dto/update-ocorrencia.dto';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { Response } from 'express';

@Controller('ocorrencias')
export class OcorrenciaController {
  constructor(private readonly service: OcorrenciaService) {}

  @Post()
  create(@Body() dto: CreateOcorrenciaDto, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload) {
    return this.service.findAll(user);
  }

  @Get('export/csv')
  async exportCSV(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const stream = await this.service.exportCSV(user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ocorrencias.csv"',
    );
    stream.pipe(res);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOcorrenciaDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user);
  }
}
