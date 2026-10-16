import { IsString, IsOptional, IsNumber, IsEnum, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusFazenda } from '@prisma/client';

export class CreateFazendaDto {
  @ApiProperty({ example: 'Fazenda Boa Esperança' })
  @IsString()
  nome: string;

  @ApiProperty({ example: 'Campo Grande' })
  @IsString()
  cidade: string;

  @ApiProperty({ example: 'MS' })
  @IsString()
  estado: string;

  @ApiProperty({ example: '1234567890123' })
  @IsString()
  cadastroIncra: string;

  @ApiPropertyOptional({ example: '1234567890CAR' })
  @IsOptional()
  @IsString()
  car?: string;

  @ApiPropertyOptional({ example: 2500.5 })
  @IsOptional()
  @IsNumber()
  areaTotal?: number;

  @ApiPropertyOptional({ enum: StatusFazenda, example: StatusFazenda.ativa })
  @IsOptional()
  @IsEnum(StatusFazenda)
  status?: StatusFazenda;

  @ApiPropertyOptional({
    description: 'Limite da propriedade: lista de anéis [{latitude, longitude}]. null apaga. Validado em perimetro.ts.',
    example: [[{ latitude: -21.98, longitude: -57.2 }, { latitude: -21.97, longitude: -57.2 }, { latitude: -21.97, longitude: -57.19 }]],
  })
  @IsOptional()
  @IsArray()
  // Valor bruto: a conversão implícita do ValidationPipe esvaziaria os pontos (objetos viram []).
  // O conteúdo é conferido ponto a ponto em perimetro.ts.
  @Transform(({ obj }) => obj.perimetro)
  perimetro?: unknown[] | null;
}
