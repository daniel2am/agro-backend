import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePesagemDto {
  @IsNotEmpty()
  @IsString()
  animalId: string;

  @IsNotEmpty()
  @IsDateString()
  data: string; // ISO date

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  pesoKg: number;
}