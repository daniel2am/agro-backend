import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProcedimentoDto {
  @IsUUID()
  lavouraId: string;

  @IsString()
  @IsNotEmpty()
  tipo: string; // defensivo, irrigação, adubação, colheita...

  @IsDateString()
  data: string;

  @IsOptional()
  @IsString()
  produto?: string;

  @IsOptional()
  @IsString()
  quantidade?: string;

  @IsOptional()
  @IsString()
  responsavel?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
