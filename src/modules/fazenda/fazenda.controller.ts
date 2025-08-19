// src/modules/fazenda/fazenda.controller.ts
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
  ParseUUIDPipe,
} from '@nestjs/common';
import { FazendaService } from './fazenda.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';

class ListFazendasQueryDto {
  // paginação simples (opcional)
  page?: number;
  pageSize?: number;
  // filtro textual opcional (nome/cidade/estado – o service decide)
  search?: string;
  // você pode acrescentar outros filtros aqui e tratar no service
}

@UseGuards(JwtAuthGuard)
@Controller('fazenda')
export class FazendaController {
  constructor(private readonly fazendaService: FazendaService) {}

  @Post()
  create(
    @Body() dto: CreateFazendaDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    return this.fazendaService.create(dto, user.id);
  }

  @Get()
  findAll(
    @AuthUser() user: UsuarioPayload,
    @Query() query: ListFazendasQueryDto,
  ) {
    // saneamento mínimo: números positivos
    const page = query.page && Number(query.page) > 0 ? Number(query.page) : undefined;
    const pageSize =
      query.pageSize && Number(query.pageSize) > 0 ? Number(query.pageSize) : undefined;

    return this.fazendaService.findAll(user.id, {
      ...query,
      page,
      pageSize,
      search: (query.search || '').trim() || undefined,
    });
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    // o service DEVE validar que a fazenda pertence ao user.id
    return this.fazendaService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateFazendaDto,
    @AuthUser() user: UsuarioPayload,
  ) {
    // idem: o service valida ownership antes de atualizar
    return this.fazendaService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @AuthUser() user: UsuarioPayload,
  ) {
    // idem: o service valida ownership antes de remover
    return this.fazendaService.remove(id, user.id);
  }
}