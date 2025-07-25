import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoLeituraDispositivo } from '@prisma/client';

export class CreateLeituraDispositivoDto {
  @IsString()
  @IsNotEmpty()
  dispositivoId: string;

  @IsString()
  @IsNotEmpty()
  fazendaId: string;

  @IsString()
  @IsNotEmpty()
  usuarioId: string;

  @IsEnum(TipoLeituraDispositivo)
  tipo: TipoLeituraDispositivo;

  @IsString()
  valor: string;

  @IsOptional()
  @IsString()
  invernadaId?: string;

  @IsOptional()
  @IsString()
  animalId?: string;
}