import { PartialType } from '@nestjs/mapped-types';
import { CreateFinanceiroDto } from './create-financeiro.dto';

export class UpdateFinanceiroDto extends PartialType(CreateFinanceiroDto) {}
