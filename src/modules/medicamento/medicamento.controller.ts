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
import { MedicamentoService } from './medicamento.service';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { UpdateMedicamentoDto } from './dto/update-medicamento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('medicamentos')
export class MedicamentoController {
  constructor(private readonly medicamentoService: MedicamentoService) {}

  @Post()
  create(@Body() dto: CreateMedicamentoDto, @AuthUser() user: UsuarioPayload) {
    return this.medicamentoService.create(dto, user);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload) {
    return this.medicamentoService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.medicamentoService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMedicamentoDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.medicamentoService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.medicamentoService.remove(id, user);
  }

  @Get('/export/csv')
  async exportCSV(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const filePath = await this.medicamentoService.exportCSV(user);
    res.download(filePath);
  }

  @Get('/export/pdf')
  async exportPDF(@AuthUser() user: UsuarioPayload, @Res() res: Response) {
    const filePath = await this.medicamentoService.exportPDF(user);
    res.download(filePath);
  }
}
