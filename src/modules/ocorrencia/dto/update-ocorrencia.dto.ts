import { PartialType } from '@nestjs/swagger';
import { CreateOcorrenciaDto } from './create-ocorrencia.dto';

export class UpdateOcorrenciaDto extends PartialType(CreateOcorrenciaDto) {}
