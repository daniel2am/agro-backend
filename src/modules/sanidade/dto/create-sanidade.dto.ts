import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSanidadeDto {
  @IsNotEmpty()
  @IsString()
  animalId: string;

  @IsDateString()
  data: string;

  @IsNotEmpty()
  @IsString()
  tipo: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
