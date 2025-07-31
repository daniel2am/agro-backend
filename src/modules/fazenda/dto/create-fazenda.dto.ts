import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
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
}
