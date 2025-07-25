import { PartialType } from '@nestjs/swagger';
import { CreateInvernadaDto } from './create-invernada.dto';

export class UpdateInvernadaDto extends PartialType(CreateInvernadaDto) {}