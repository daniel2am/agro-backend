import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateSanidadeDto {
  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
