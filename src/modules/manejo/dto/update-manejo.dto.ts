import { PartialType } from '@nestjs/mapped-types';
import { CreateManejoDto } from './create-manejo.dto';

export class UpdateManejoDto extends PartialType(CreateManejoDto) {}
