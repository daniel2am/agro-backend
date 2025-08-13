import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MedicamentoService } from './medicamento.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('medicamentos')
export class MedicamentoController {
  constructor(private readonly service: MedicamentoService) {}

  @Post()
  create(@Body() dto: any, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user.id);
  }

  @Get('animal/:animalId')
  listByAnimal(@Param('animalId') animalId: string, @AuthUser() user: UsuarioPayload) {
    return this.service.listByAnimal(animalId, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @AuthUser() user: UsuarioPayload) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user.id);
  }
}