import { IsOptional, IsString } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;
  senha?: string;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
}