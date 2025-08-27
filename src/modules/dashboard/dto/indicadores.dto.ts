// src/modules/dashboard/dto/indicadores.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

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
  // Envie como 'YYYY-MM-DD' ou ISO completo; ex.: '2025-01-01' ou '2025-01-01T00:00:00.000Z'
  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ enum: GroupBy, example: GroupBy.month })
  @IsOptional()
  @IsEnum(GroupBy)
  groupBy?: GroupBy;

  @ApiPropertyOptional({ example: 'uuid-invernada' })
  @IsOptional()
  @IsString()
  invernadaId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-animal-1', 'uuid-animal-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  animalIds?: string[];

  // financeiro: 'saldo' | 'receita' | 'despesa'
  @ApiPropertyOptional({ example: 'saldo', enum: ['saldo', 'receita', 'despesa'] })
  @IsOptional()
  @IsIn(['saldo', 'receita', 'despesa'])
  natureza?: 'saldo' | 'receita' | 'despesa';
}

export type IndicadoresResposta = {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
};