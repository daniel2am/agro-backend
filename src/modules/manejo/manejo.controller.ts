import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ManejoService } from './manejo.service';
import { CreateManejoDto } from './dto/create-manejo.dto';
import { UpdateManejoDto } from './dto/update-manejo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from 'src/modules/auth/dto/usuario-payload.interface';
import { Response } from 'express';
import { createReadStream } from 'fs';

@UseGuards(JwtAuthGuard)
@Controller('manejos')
export class ManejoController {
  constructor(private readonly manejoService: ManejoService) {}

  @Post()
  create(
    @Body() dto: CreateManejoDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.manejoService.create(dto, user);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload) {
    return this.manejoService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.manejoService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateManejoDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.manejoService.update(id, dto, user);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.manejoService.remove(id, user);
  }

  @Get('export/csv')
  async exportCSV(
    @AuthUser() user: UsuarioPayload,
    @Res() res: Response,
  ) {
    const filePath = await this.manejoService.exportToCSV(user);
    const stream = createReadStream(filePath);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=manejos.csv');
    stream.pipe(res);
  }

  @Get('export/pdf')
  async exportPDF(
    @AuthUser() user: UsuarioPayload,
    @Res() res: Response,
  ) {
    const filePath = await this.manejoService.exportToPDF(user);
    const stream = createReadStream(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=manejos.pdf');
    stream.pipe(res);
  }
}
