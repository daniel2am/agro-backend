import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards
} from '@nestjs/common';
import { SanidadeService } from './sanidade.service';
import { CreateSanidadeDto } from './dto/create-sanidade.dto';
import { UpdateSanidadeDto } from './dto/update-sanidade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

type ListQuery = {
  take?: string;
  skip?: string;
  search?: string;
};

@UseGuards(JwtAuthGuard)
@Controller('sanidade')
export class SanidadeController {
  constructor(private readonly sanidadeService: SanidadeService) {}

  @Post()
  create(@Body() dto: CreateSanidadeDto, @AuthUser() user: UsuarioPayload) {
    return this.sanidadeService.create(dto, user.id);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload, @Query() query: ListQuery) {
    return this.sanidadeService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.sanidadeService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSanidadeDto, @AuthUser() user: UsuarioPayload) {
    return this.sanidadeService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.sanidadeService.remove(id, user.id);
  }
}
