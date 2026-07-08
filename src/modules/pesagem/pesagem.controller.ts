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
import { PesagemService } from './pesagem.service';
import { CreatePesagemDto } from './dto/create-pesagem.dto';
import { UpdatePesagemDto } from './dto/update-pesagem.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('pesagens')
export class PesagemController {
  constructor(private readonly pesagemService: PesagemService) {}

  @Post()
  create(@Body() dto: CreatePesagemDto, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.create(dto, user.id);
  }

  @Get()
  findAll(@Query() query: any, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.findOne(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePesagemDto, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @AuthUser() user: UsuarioPayload) {
    return this.pesagemService.remove(id, user.id);
  }
}
