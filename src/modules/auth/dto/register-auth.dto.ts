import { ApiProperty } from '@nestjs/swagger';
export class RegisterAuthDto {
  @ApiProperty({ example: 'Seu Nome', description: 'Nome completo do usuário' })
  nome: string;
  @ApiProperty({ example: 'seuemail@email.com' })
  email: string;
  @ApiProperty({ example: 'Senha123' })
  senha: string;
}
