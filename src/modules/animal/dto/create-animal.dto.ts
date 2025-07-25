import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateAnimalDto {
  @IsString()
  @Length(1, 20)
  brinco: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(['M', 'F'], { message: 'sexo deve ser M ou F' })
  sexo?: string;

  @IsOptional()
  @IsString()
  raca?: string;

  @IsOptional()
  @IsDateString()
  nascimento?: string;

  @IsString()
  fazendaId: string;

  @IsOptional()
  @IsString()
  invernadaId?: string;
}
