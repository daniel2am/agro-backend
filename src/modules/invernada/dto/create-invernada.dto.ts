import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateInvernadaDto {
  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsNumber()
  areaHa: number;

  @IsNotEmpty()
  @IsString()
  fazendaId: string;
}
