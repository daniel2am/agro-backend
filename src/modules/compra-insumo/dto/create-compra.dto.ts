import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateCompraInsumoDto {
  @IsDateString()
  data: string;

  @IsString()
  @IsNotEmpty()
  insumo: string;

  @IsNumber()
  quantidade: number;

  @IsString()
  unidade: string;

  @IsNumber()
  valor: number;

  @IsOptional()
  @IsString()
  fornecedor?: string;
}
