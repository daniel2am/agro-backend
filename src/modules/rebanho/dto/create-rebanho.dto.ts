import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRebanhoDto {
  @IsUUID()
  fazendaId: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  tipo?: string; // cria, recria, engorda, vaca, touro...

  @IsOptional()
  @IsString()
  observacoes?: string;
}
