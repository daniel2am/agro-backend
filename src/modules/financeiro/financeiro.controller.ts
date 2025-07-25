import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';
import { UpdateFinanceiroDto } from './dto/update-financeiro.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('financeiro')
@UseGuards(JwtAuthGuard)
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Post()
  create(@Body() dto: CreateFinanceiroDto, @Req() req: Request) {
    return this.service.create(dto, req.user["sub"]);
  }

  @Get()
  findAll(@Req() req: Request, @Query() query: any) {
    return this.service.findAll(req.user["sub"], query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.service.findOne(id, req.user["sub"]);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFinanceiroDto, @Req() req: Request) {
    return this.service.update(id, dto, req.user["sub"]);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.service.remove(id, req.user["sub"]);
  }
}