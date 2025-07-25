import { IsUUID, IsDateString, IsNumber } from 'class-validator';

export class CreatePesagemDto {
  @IsUUID()
  animalId: string;

  @IsDateString()
  data: Date;

  @IsNumber()
  pesoKg: number;
}
