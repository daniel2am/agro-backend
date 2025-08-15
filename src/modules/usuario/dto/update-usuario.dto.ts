import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TipoUsuario } from '@prisma/client';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  senha?: string;

  @IsOptional()
  @IsString()
  googleId?: string | null;

  @IsOptional()
  @IsString()
  appleId?: string | null;

  // recuperação de senha
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
  status?: string;

  @IsOptional()
  @IsString()
  fotoUrl?: string;

  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;
}
