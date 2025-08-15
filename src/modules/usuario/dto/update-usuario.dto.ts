// src/modules/usuario/dto/update-usuario.dto.ts
import { IsEmail, IsOptional, IsString, IsBoolean, IsISO8601, IsEnum } from 'class-validator';
import { TipoUsuario } from '@prisma/client';

export class UpdateUsuarioDto {
  @IsOptional() @IsString()
  nome?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  senha?: string;

  @IsOptional() @IsString()
  fotoUrl?: string;

  @IsOptional() @IsString()
  status?: string; // "ativo" | "inativo", etc.

  // ✅ agora é enum de verdade
  @IsOptional() @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;

  @IsOptional() @IsString()
  googleId?: string | null;

  @IsOptional() @IsString()
  appleId?: string | null;

  @IsOptional() @IsString()
  resetToken?: string | null;

  @IsOptional() @IsISO8601()
  resetTokenExpires?: string | null;

  @IsOptional() @IsISO8601()
  termosAceitosEm?: string | null;

  @IsOptional() @IsISO8601()
  ultimoLogin?: string | null;
}