import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'abcdef123456', description: 'Token recebido por e-mail' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NovaSenhaSegura123', description: 'Nova senha do usuário' })
  @IsString()
  @MinLength(6)
  senha: string;
}
