import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOcorrenciaDto {
  @ApiProperty({ example: 'Doença detectada', description: 'Título da ocorrência' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiProperty({ example: 'Animal apresentou sinais de febre', required: false })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiProperty({ example: '2025-07-25T08:00:00.000Z' })
  @IsDateString()
  data: Date;

  @ApiProperty({ example: 'Sanidade', description: 'Tipo da ocorrência' })
  @IsString()
  @IsNotEmpty()
  tipo: string;

  @ApiProperty({ example: 'uuid-do-animal', required: false })
  @IsString()
  @IsOptional()
  animalId?: string;
}
