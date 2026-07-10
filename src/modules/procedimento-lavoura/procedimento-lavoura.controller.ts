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
} from '@nestjs/common';
import { ProcedimentoLavouraService } from './procedimento-lavoura.service';
import { CreateProcedimentoDto } from './dto/create-procedimento.dto';
import { UpdateProcedimentoDto } from './dto/update-procedimento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('procedimentos-lavoura')
export class ProcedimentoLavouraController {
  constructor(private readonly service: ProcedimentoLavouraService) {}

  @Post()
  create(@Body() dto: CreateProcedimentoDto, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user.id);
  }

  // GET /procedimentos-lavoura?lavouraId=...
  @Get()
  findByLavoura(@Query('lavouraId') lavouraId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findByLavoura(lavouraId, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcedimentoDto, @AuthUser() user: UsuarioPayload) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user.id);
  }
}
