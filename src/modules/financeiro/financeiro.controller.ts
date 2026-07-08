import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';
import { UpdateFinanceiroDto } from './dto/update-financeiro.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@Controller('financeiro')
@UseGuards(JwtAuthGuard)
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Post()
  create(@Body() dto: CreateFinanceiroDto, @AuthUser() user: UsuarioPayload) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload, @Query() query: any) {
    return this.service.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFinanceiroDto, @AuthUser() user: UsuarioPayload) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.service.remove(id, user.id);
  }
}
