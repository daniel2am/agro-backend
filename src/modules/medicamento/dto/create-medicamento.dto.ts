import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateMedicamentoDto {
  animalId: string;
  nome: string;
  data: string; // ISO
  @IsOptional() dosagem?: string;
  @IsOptional() viaAplicacao?: string;
  @IsOptional() observacoes?: string;

  // lembrete
  @IsOptional() @IsBoolean() lembreteAtivo?: boolean;
  @IsOptional() @IsDateString() proximaAplicacao?: string; // ISO
  @IsOptional() @IsInt() @Min(1) proximaDoseEmDias?: number; // se usado, o backend calcula a data
  @IsOptional() notificacaoId?: string; // o app pode salvar depois via PATCH
}
