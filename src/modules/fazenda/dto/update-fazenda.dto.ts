import { PartialType } from '@nestjs/mapped-types';
import { CreateFazendaDto } from './create-fazenda.dto';

export class UpdateFazendaDto extends PartialType(CreateFazendaDto) {}