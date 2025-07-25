import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { StatusLavoura } from '@prisma/client';

export class CreateLavouraDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  cultura: string;

  @IsNumber()
  areaHa: number;

  @IsDateString()
  dataPlantio: Date;

  @IsEnum(StatusLavoura)
  @IsOptional()
  status?: StatusLavoura;

  @IsString()
  @IsNotEmpty()
  fazendaId: string;
}