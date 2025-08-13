import { PartialType } from '@nestjs/swagger';
import { CreatePesagemDto } from './create-pesagem.dto';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePesagemDto extends PartialType(CreatePesagemDto) {
  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pesoKg?: number;
}