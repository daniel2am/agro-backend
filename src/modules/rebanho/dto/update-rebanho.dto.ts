import { PartialType } from '@nestjs/mapped-types';
import { CreateRebanhoDto } from './create-rebanho.dto';

export class UpdateRebanhoDto extends PartialType(CreateRebanhoDto) {}
