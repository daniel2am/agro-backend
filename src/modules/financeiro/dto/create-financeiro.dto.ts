import { IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
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

  // ---- Dados fiscais (LCDPR). Todos opcionais; `null` limpa ao editar.

  // Conta bancária por onde o dinheiro passou (de um administrador da fazenda)
  @IsOptional()
  @IsUUID()
  contaBancariaId?: string | null;

  // 1 Nota fiscal · 2 Fatura · 3 Recibo · 4 Contrato · 5 Folha de pagamento · 6 Outros
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  documentoTipo?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  documentoNumero?: string | null;

  // CPF ou CNPJ de quem pagou (receita) ou recebeu (despesa)
  @IsOptional()
  @IsString()
  @MaxLength(18)
  contraparteDoc?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contraparteNome?: string | null;
}
