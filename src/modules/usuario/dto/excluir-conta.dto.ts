import { IsOptional, IsString } from 'class-validator';

export class ExcluirContaDto {
  // obrigatória para contas com senha; contas Google/Apple não usam
  @IsOptional() @IsString()
  senha?: string;
}
