import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FazendaService } from './fazenda.service';
import { CreateFazendaDto, UpdateFazendaDto } from './fazenda.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiBearerAuth()
@ApiTags('Fazendas')
@UseGuards(JwtAuthGuard)
@Controller('fazendas')
export class FazendaController {
  constructor(private readonly fazendaService: FazendaService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova fazenda' })
  create(@Body() dto: CreateFazendaDto, @Req() req) {
    return this.fazendaService.create(dto, req.user.id);
  }

  @Post('ccir-upload')
  @ApiOperation({ summary: 'Extrair dados do PDF CCIR e sugerir cadastro' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }}}})
  @UseInterceptors(FileInterceptor('file'))
  async uploadCcir(@UploadedFile() file: Express.Multer.File) {
    return this.fazendaService.parseCcirPdf(file);
  }

  @Get()
  @ApiOperation({ summary: 'Listar fazendas do usuário' })
  findAll(@Req() req, @Query() query) {
    return this.fazendaService.findAll(req.user.id, query);
  }

  @Get('csv')
  @ApiOperation({ summary: 'Exportar fazendas para CSV' })
  async exportCSV(@Req() req, @Res() res: Response) {
    const { buffer, filename } = await this.fazendaService.exportCSV(req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(buffer);
  }

  @Get('pdf')
  @ApiOperation({ summary: 'Exportar fazendas para PDF' })
  async exportPDF(@Req() req, @Res() res: Response) {
    const { buffer, filename } = await this.fazendaService.exportPDF(req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar fazenda por ID' })
  findOne(@Param('id') id: string, @Req() req) {
    return this.fazendaService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar fazenda' })
  update(@Param('id') id: string, @Body() dto: UpdateFazendaDto, @Req() req) {
    return this.fazendaService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir fazenda' })
  remove(@Param('id') id: string, @Req() req) {
    return this.fazendaService.remove(id, req.user.id);
  }
}
