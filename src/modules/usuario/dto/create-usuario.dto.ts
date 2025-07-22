import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  senha: string;

  @IsString()
  googleId?: string; // opcional, para login com Google
}