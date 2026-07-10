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
import { RebanhoService } from './rebanho.service';
import { CreateRebanhoDto } from './dto/create-rebanho.dto';
import { UpdateRebanhoDto } from './dto/update-rebanho.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('rebanhos')
export class RebanhoController {
  constructor(private readonly service: RebanhoService) {}

  @Post()
  create(@Body() dto: CreateRebanhoDto, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload, @Query('fazendaId') fazendaId?: string) {
    return this.service.findAll(user.id, fazendaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRebanhoDto, @AuthUser() user: UsuarioPayload) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user.id);
  }
}
