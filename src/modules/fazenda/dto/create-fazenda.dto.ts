import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { StatusFazenda } from '@prisma/client';

export class CreateFazendaDto {
  @IsString()
  nome: string;

  @IsString()
  cidade: string;

  @IsString()
  estado: string;

  @IsString()
  cadastroIncra: string;

  @IsOptional()
  @IsString()
  car?: string;

  @IsOptional()
  @IsNumber()
  areaTotal?: number;

  @IsOptional()
  @IsEnum(StatusFazenda)
  status?: StatusFazenda;
}
