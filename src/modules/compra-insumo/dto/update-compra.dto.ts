import { PartialType } from '@nestjs/mapped-types';
import { CreateCompraInsumoDto } from './create-compra.dto';

export class UpdateCompraInsumoDto extends PartialType(CreateCompraInsumoDto) {}
