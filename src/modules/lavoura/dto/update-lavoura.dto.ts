import { PartialType } from '@nestjs/mapped-types';
import { CreateLavouraDto } from './create-lavoura.dto';

export class UpdateLavouraDto extends PartialType(CreateLavouraDto) {}