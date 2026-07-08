import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { LavouraService } from './lavoura.service';
import { CreateLavouraDto, UpdateLavouraDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@Controller('lavoura')
@UseGuards(JwtAuthGuard)
export class LavouraController {
  constructor(private readonly lavouraService: LavouraService) {}

  @Post()
  create(@Body() dto: CreateLavouraDto, @AuthUser() user: UsuarioPayload) {
    return this.lavouraService.create(dto, user.id);
  }

  @Get()
  findAll(@AuthUser() user: UsuarioPayload) {
    return this.lavouraService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.lavouraService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLavouraDto, @AuthUser() user: UsuarioPayload) {
    return this.lavouraService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.lavouraService.remove(id, user.id);
  }
}
