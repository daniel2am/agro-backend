import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'usuario@email.com', description: 'E-mail do usuário para envio de link de recuperação' })
  @IsEmail()
  email: string;
}
