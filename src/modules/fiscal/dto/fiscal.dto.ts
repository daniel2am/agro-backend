import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class ContribuinteDto {
  @IsString() @MaxLength(18) cpf: string;
  @IsString() @MaxLength(100) nome: string;
  @IsString() @MaxLength(150) endereco: string;
  @IsString() @MaxLength(6) numero: string;
  @IsOptional() @IsString() @MaxLength(50) complemento?: string | null;
  @IsString() @MaxLength(50) bairro: string;
  @IsString() @MaxLength(2) uf: string;
  @IsString() @MaxLength(7) codMunicipio: string;
  @IsString() @MaxLength(9) cep: string;
  @IsOptional() @IsString() @MaxLength(20) telefone?: string | null;
  @IsEmail() @MaxLength(115) email: string;

  @IsOptional() @IsString() @MaxLength(100) contadorNome?: string | null;
  @IsOptional() @IsString() @MaxLength(18) contadorDoc?: string | null;
  @IsOptional() @IsString() @MaxLength(30) contadorCrc?: string | null;
  @IsOptional() @IsEmail() @MaxLength(115) contadorEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(20) contadorFone?: string | null;
}

export class ContraparteDto {
  @IsInt() @Min(1) @Max(5) tipo: number;
  @IsString() @MaxLength(18) documento: string;
  @IsString() @MaxLength(50) nome: string;
  @IsNumber() @Min(0) @Max(100) percentual: number;
}

export class ImovelDto {
  @IsOptional() @IsString() @MaxLength(12) codItr?: string | null;
  @IsOptional() @IsString() @MaxLength(18) caepf?: string | null;
  @IsOptional() @IsString() @MaxLength(20) inscricaoEstadual?: string | null;
  @IsString() @MaxLength(150) endereco: string;
  @IsOptional() @IsString() @MaxLength(6) numero?: string | null;
  @IsOptional() @IsString() @MaxLength(50) complemento?: string | null;
  @IsString() @MaxLength(50) bairro: string;
  @IsString() @MaxLength(9) cep: string;
  @IsString() @MaxLength(7) codMunicipio: string;
  @IsInt() @Min(1) @Max(6) tipoExploracao: number;
  @IsNumber() @Min(0.01) @Max(100) participacaoPct: number;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ContraparteDto)
  contrapartes: ContraparteDto[];
}

export class ContaDto {
  @IsString() @MaxLength(3) banco: string;
  @IsString() @MaxLength(30) nomeBanco: string;
  @IsString() @MaxLength(4) agencia: string;
  @IsString() @MaxLength(20) numeroConta: string;
}
