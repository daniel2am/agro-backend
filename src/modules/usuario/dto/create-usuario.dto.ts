import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TipoUsuario } from '@prisma/client';

export class CreateUsuarioDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  senha: string;

  @IsOptional()
  @IsString()
  googleId?: string | null;

  @IsOptional()
  @IsString()
  appleId?: string | null;

  @IsOptional()
  @IsString()
  fotoUrl?: string;

  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;
}
