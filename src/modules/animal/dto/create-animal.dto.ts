import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export enum UnidadeIdade {
  dias = 'dias',
  meses = 'meses',
  anos = 'anos',
}

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
  @IsInt()
  idade?: number;

  @IsOptional()
  @IsEnum(UnidadeIdade, {
    message: 'unidadeIdade deve ser dias, meses ou anos',
  })
  unidadeIdade?: UnidadeIdade;

  @IsString()
  fazendaId: string;

  @IsOptional()
  @IsString()
  invernadaId?: string;
}
