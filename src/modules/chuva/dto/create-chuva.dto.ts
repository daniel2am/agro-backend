import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateChuvaDto {
  @IsString()
  fazendaId: string;

  // string "YYYY-MM-DD" (e não Date): ver nota em create-lavoura.dto.ts
  @IsString()
  data: string;

  // 0 é válido ("não choveu"); 1000 mm num dia já é recorde mundial
  @IsNumber()
  @Min(0)
  @Max(1000)
  mm: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacao?: string;
}
