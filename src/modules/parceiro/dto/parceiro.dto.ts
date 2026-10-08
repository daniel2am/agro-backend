import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ESCOPOS, TIPOS_PARCEIRO } from '../parceiro.regras';
import { PLANOS } from '../../plano/planos';

export class CriarParceiroDto {
  @IsString() @MaxLength(100) nome: string;
  @IsIn(TIPOS_PARCEIRO as unknown as string[]) tipo: string;
  /** E-mail de um usuário que já tem conta: vira administrador do parceiro. */
  @IsEmail() emailAdmin: string;
}

export class CriarConviteDto {
  @IsOptional() @IsString() @MaxLength(80) nota?: string;
  @IsOptional() @IsIn(PLANOS as unknown as string[]) plano?: string;
  @IsOptional() @IsInt() @Min(0) @Max(36) mesesPlano?: number;
  @IsArray() @ArrayMaxSize(10) @IsIn(ESCOPOS as unknown as string[], { each: true }) escopos: string[];
  @IsOptional() @IsInt() @Min(1) @Max(10000) usosMax?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasValidade?: number;
}

export class AceitarConviteDto {
  @IsUUID() fazendaId: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) escopos: string[];
}

export class AdicionarMembroDto {
  @IsEmail() email: string;
  @IsOptional() @IsIn(['admin', 'representante']) papel?: string;
}
