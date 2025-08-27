// src/modules/dashboard/dto/indicadores.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export enum TipoIndicador {
  peso = 'peso',
  financeiro = 'financeiro',
}

export enum GroupBy {
  day = 'day',
  month = 'month',
  quarter = 'quarter',
}

export class IndicadoresFiltro {
  @ApiProperty({ example: '2025-01-01' })
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty({ example: '2025-12-31' })
  @Type(() => Date)
  @IsDate()
  to: Date;

  @ApiPropertyOptional({ enum: GroupBy, example: GroupBy.month })
  @IsOptional()
  @IsEnum(GroupBy)
  groupBy?: GroupBy;

  @ApiPropertyOptional({ example: 'uuid-invernada' })
  @IsOptional()
  @IsString()
  invernadaId?: string;

  @ApiPropertyOptional({ type: [String], example: ['uuid-animal-1', 'uuid-animal-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  animalIds?: string[];

  @ApiPropertyOptional({ example: 'saldo', enum: ['saldo', 'receita', 'despesa'] })
  @IsOptional()
  @IsIn(['saldo', 'receita', 'despesa'])
  natureza?: 'saldo' | 'receita' | 'despesa';
}

export type IndicadoresResposta = {
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
};