import { ApiProperty } from '@nestjs/swagger';

export class TitularFazendaDto {
  @ApiProperty() nome: string;
  @ApiProperty() cpfCnpj: string;
  @ApiProperty() nacionalidade: string;
  @ApiProperty() condicao: string;
  @ApiProperty() percentualDetencao: number;
}

export class CreateFazendaDto {
  @ApiProperty() nome: string;
  @ApiProperty() cidade: string;
  @ApiProperty() estado: string;
  @ApiProperty() cadastroIncra: string;
  @ApiProperty({ required: false }) car?: string;
  @ApiProperty({ required: false }) areaTotal?: number;
  @ApiProperty({ type: [TitularFazendaDto], required: false }) titulares?: TitularFazendaDto[];
}

export class UpdateFazendaDto {
  @ApiProperty({ required: false }) nome?: string;
  @ApiProperty({ required: false }) cidade?: string;
  @ApiProperty({ required: false }) estado?: string;
  @ApiProperty({ required: false }) cadastroIncra?: string;
  @ApiProperty({ required: false }) car?: string;
  @ApiProperty({ required: false }) areaTotal?: number;
  @ApiProperty({ required: false }) status?: string;
  @ApiProperty({ type: [TitularFazendaDto], required: false }) titulares?: TitularFazendaDto[];
}
