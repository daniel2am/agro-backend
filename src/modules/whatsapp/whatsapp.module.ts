import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { CloudApiCliente, WHATSAPP_CLIENTE } from './whatsapp.cliente';
import { AnthropicInterpretador, INTERPRETADOR, OpenAiTranscritor, TRANSCRITOR } from './whatsapp.ia';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { ChuvaService } from '../chuva/chuva.service';
import { PesagemService } from '../pesagem/pesagem.service';

@Module({
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    FinanceiroService,
    ChuvaService,
    PesagemService,
    { provide: WHATSAPP_CLIENTE, useFactory: () => new CloudApiCliente() },
    { provide: INTERPRETADOR, useFactory: () => new AnthropicInterpretador() },
    { provide: TRANSCRITOR, useFactory: () => new OpenAiTranscritor() },
  ],
})
export class WhatsappModule {}
