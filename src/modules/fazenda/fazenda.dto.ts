import { ApiProperty } from '@nestjs/swagger';

export class CreateFazendaDto {
  @ApiProperty() nome: string;
  @ApiProperty() cidade: string;
  @ApiProperty() estado: string;
  @ApiProperty() cadastroIncra: string;
  @ApiProperty({ required: false }) car?: string;
  @ApiProperty({ required: false }) titular?: string;
  @ApiProperty({ required: false }) areaTotal?: number;
}

export class UpdateFazendaDto {
  @ApiProperty({ required: false }) nome?: string;
  @ApiProperty({ required: false }) cidade?: string;
  @ApiProperty({ required: false }) estado?: string;
  @ApiProperty({ required: false }) cadastroIncra?: string;
  @ApiProperty({ required: false }) car?: string;
  @ApiProperty({ required: false }) titular?: string;
  @ApiProperty({ required: false }) areaTotal?: number;
  @ApiProperty({ required: false }) status?: string;
}
