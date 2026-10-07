import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { TipoFinanceiro } from '@prisma/client';
import { CATEGORIAS } from '../categorias';

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

  // Categoria do lançamento (ração, vacina, combustível…)
  @IsOptional()
  @IsIn(CATEGORIAS as unknown as string[])
  categoria?: string;

  // Despesa alocada em uma lavoura (custo da safra). Só vale para tipo=despesa.
  @IsOptional()
  @IsUUID()
  custoLavouraId?: string;
}
