import { PartialType } from '@nestjs/mapped-types';
import { CreatePesagemDto } from './create-pesagem.dto';

export class UpdatePesagemDto extends PartialType(CreatePesagemDto) {}
