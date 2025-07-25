import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMedicamentoDto {
  @ApiProperty({ example: 'Paracetamol', description: 'Nome do medicamento' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiProperty({ example: '2025-07-25', description: 'Data da aplicação' })
  @IsDateString()
  data: Date;

  @ApiProperty({ example: '1 mL/kg', description: 'Dosagem administrada', required: false })
  @IsOptional()
  @IsString()
  dosagem?: string;

  @ApiProperty({ example: 'Oral', description: 'Via de aplicação', required: false })
  @IsOptional()
  @IsString()
  viaAplicacao?: string;

  @ApiProperty({ example: 'Aplicado após diagnóstico de febre', required: false })
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiProperty({ example: 'uuid-do-animal', description: 'ID do animal' })
  @IsUUID()
  animalId: string;
}
