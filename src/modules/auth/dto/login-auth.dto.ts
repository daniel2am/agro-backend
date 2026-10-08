import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDto {
  @ApiProperty({ example: 'usuario@email.com', description: 'E-mail do usuário' })
  @IsEmail()
  @Matches(/^[^\u0000]*$/, { message: 'e-mail inválido' }) // o Postgres rejeita o byte nulo e viraria 500
  email: string;

  @ApiProperty({ example: 'senha123', description: 'Senha do usuário' })
  @IsString()
  @MinLength(6)
  @Matches(/^[^\u0000]*$/, { message: 'senha inválida' })
  senha: string;
}
