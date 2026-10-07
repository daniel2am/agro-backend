import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateCompraInsumoDto {
  @IsUUID()
  fazendaId: string;

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

  // Lavoura que consome este insumo: o custo entra no resultado dela.
  @IsOptional()
  @IsUUID()
  lavouraId?: string;
}
