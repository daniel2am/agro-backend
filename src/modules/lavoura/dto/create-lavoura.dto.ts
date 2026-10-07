import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { StatusLavoura } from '@prisma/client';

export class CreateLavouraDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  cultura: string;

  @IsNumber()
  areaHa: number;

  // ISO 8601. Declarado como string de propósito: com `enableImplicitConversion` no
  // ValidationPipe, uma propriedade tipada `Date` vira Date ANTES da validação e o
  // @IsDateString() a rejeitava — o cadastro de lavoura devolvia 400 sempre.
  @IsDateString()
  dataPlantio: string;

  @IsOptional()
  @IsString()
  semente?: string;

  @IsEnum(StatusLavoura)
  @IsOptional()
  status?: StatusLavoura;

  @IsString()
  @IsNotEmpty()
  fazendaId: string;
}