import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInvernadaDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsNumber()
  area: number;

  @IsOptional()
  poligono?: any; // tipo Json

  @IsNotEmpty()
  @IsString()
  fazendaId: string;
}
