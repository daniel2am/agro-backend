import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { TipoFinanceiro } from '@prisma/client';

export class CreateFinanceiroDto {
  @IsDateString()
  data: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsNumber()
  valor: number;

  @IsEnum(TipoFinanceiro)
  tipo: TipoFinanceiro;
}