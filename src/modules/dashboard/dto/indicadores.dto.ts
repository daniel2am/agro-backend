import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum TipoIndicador {
  peso = 'peso',
  financeiro = 'financeiro',
}

export enum GroupBy {
  month = 'month',
  animal = 'animal',
}

export class IndicadoresBodyDto {
  @IsEnum(TipoIndicador)
  tipo!: TipoIndicador;

  @IsDateString()
  from!: string; // ISO

  @IsDateString()
  to!: string;   // ISO

  @IsOptional()
  @IsString()
  invernadaId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  animalIds?: string[];

  @IsOptional()
  @IsEnum(GroupBy)
  groupBy?: GroupBy; // default: month (se não enviar)
}