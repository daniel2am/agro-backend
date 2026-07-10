import { PartialType } from '@nestjs/mapped-types';
import { CreateProcedimentoDto } from './create-procedimento.dto';

export class UpdateProcedimentoDto extends PartialType(CreateProcedimentoDto) {}
