import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { UnidadeIdade } from './create-animal.dto';

export class UpdateAnimalDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  brinco?: string;

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

  @IsOptional()
  @IsString()
  fazendaId?: string;

  @IsOptional()
  @IsString()
  invernadaId?: string;
}
