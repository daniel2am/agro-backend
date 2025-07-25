import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoDispositivo } from '@prisma/client';

export class CreateMarcaModeloDto {
  @IsString()
  @IsNotEmpty()
  fabricante: string;

  @IsString()
  @IsNotEmpty()
  modelo: string;

  @IsEnum(TipoDispositivo)
  tipo: TipoDispositivo;

  @IsOptional()
  @IsString()
  protocolo?: string;

  @IsOptional()
  @IsString()
  infoExtra?: string;
}