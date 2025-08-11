// src/modules/invernada/dto/create-invernada.dto.ts
import {
  IsArray,
  ArrayMinSize,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoordenadaDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

export class CreateInvernadaDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  // área em hectares (number). O ValidationPipe converte "12.34" -> 12.34
  @Type(() => Number)
  @IsNumber()
  area: number;

  // polígono opcional, mas se vier precisa ter >= 3 pontos válidos
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordenadaDto)
  @ArrayMinSize(3)
  poligono?: CoordenadaDto[];

  @IsNotEmpty()
  @IsString()
  fazendaId: string;
}