// src/modules/animal/dto/create-animal.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, Length, IsNumber, IsIn } from 'class-validator';

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

  // use IsIn em vez de IsEnum com array
  @IsOptional()
  @IsIn(['M', 'F'], { message: 'sexo deve ser M ou F' })
  sexo?: 'M' | 'F';

  @IsOptional()
  @IsString()
  raca?: string;

  @IsOptional()
  @IsInt()
  idade?: number;

  @IsOptional()
  @IsEnum(UnidadeIdade, { message: 'unidadeIdade deve ser dias, meses ou anos' })
  unidadeIdade?: UnidadeIdade;

  @IsString()
  fazendaId: string;

  @IsOptional()
  @IsString()
  invernadaId?: string;

  // novos
  @IsOptional()
  @IsNumber()
  peso?: number;

  @IsOptional()
  @IsString()
  lote?: string;
}