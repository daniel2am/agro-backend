import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { TipoFinanceiro } from '@prisma/client';

export class CreateFinanceiroDto {
  @IsUUID()
  fazendaId: string;

  @IsDateString()
  data: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsNumber()
  valor: number;

  @IsEnum(TipoFinanceiro)
  tipo: TipoFinanceiro;

  // Venda de gado: informar o animal vendido dá baixa automática no rebanho
  @IsOptional()
  @IsUUID()
  animalId?: string;

  // Venda de lavoura: informar a lavoura e a área vendida subtrai da área total
  @IsOptional()
  @IsUUID()
  lavouraId?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  areaVendidaHa?: number;
}
