import {
  Controller,
  Post,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import { AnimalService } from './animal.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response, Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('animais')
export class AnimalController {
  constructor(private readonly service: AnimalService) {}

  @Post()
  create(@Body() dto: CreateAnimalDto, @Req() req: Request) {
    return this.service.create(dto, req.user['sub']);
  }

  @Get()
  findAll(@Query() query, @Req() req: Request) {
    return this.service.findAll(req.user['sub'], query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.service.findOne(id, req.user['sub']);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnimalDto, @Req() req: Request) {
    return this.service.update(id, dto, req.user['sub']);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.service.remove(id, req.user['sub']);
  }

  @Get('export/csv')
  async exportCSV(@Res() res: Response, @Req() req: Request) {
    const { buffer, filename } = await this.service.exportCSV(req.user['sub']);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(buffer);
  }

  @Get('export/pdf')
  async exportPDF(@Res() res: Response, @Req() req: Request) {
    const { buffer, filename } = await this.service.exportPDF(req.user['sub']);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  }
}
