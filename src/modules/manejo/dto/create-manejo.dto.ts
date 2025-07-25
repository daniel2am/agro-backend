import { IsUUID, IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateManejoDto {
  @IsUUID()
  animalId: string;

  @IsString()
  tipo: string;

  @IsDateString()
  data: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
