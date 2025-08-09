// src/modules/animal/dto/create-animal.dto.ts
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UnidadeIdade {
  dias = 'dias',
  meses = 'meses',
  anos = 'anos',
}

export class CreateAnimalDto {
  @IsString()
  @Length(1, 20)
  brinco: string;

  @IsOptional()
  @IsString()
  nome?: string;

  // Sexo somente 'M' ou 'F'
  @IsOptional()
  @IsIn(['M', 'F'], { message: 'sexo deve ser M ou F' })
  sexo?: string;

  @IsOptional()
  @IsString()
  raca?: string;

  // Idade numérica
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idade?: number;

  @IsOptional()
  @IsEnum(UnidadeIdade, {
    message: 'unidadeIdade deve ser dias, meses ou anos',
  })
  unidadeIdade?: UnidadeIdade;

  // Peso numérico (opcional)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  peso?: number;

  @IsString()
  fazendaId: string;

  @IsOptional()
  @IsString()
  invernadaId?: string;

  @IsOptional()
  @IsString()
  lote?: string;
}