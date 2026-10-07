import { ValidationPipe } from '@nestjs/common';
import { CreateLavouraDto } from 'src/modules/lavoura/dto';
import { CreateOcorrenciaDto } from 'src/modules/ocorrencia/dto/create-ocorrencia.dto';
import { CreateFinanceiroDto } from 'src/modules/financeiro/dto/create-financeiro.dto';

/**
 * Mesma configuração do ValidationPipe global (src/main.ts). O que se trava aqui:
 * com `enableImplicitConversion`, uma propriedade tipada `Date` é convertida ANTES
 * de validar, e `@IsDateString()` recusa o Date resultante — o endpoint devolvia 400
 * para qualquer data válida. (Foi o que quebrou o cadastro de lavoura em produção.)
 */
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: false,
  transformOptions: { enableImplicitConversion: true },
});

const validar = (metatype: any, dado: object) =>
  pipe.transform(dado, { type: 'body', metatype });

describe('ValidationPipe global — datas em DTOs', () => {
  const ISO = '2026-08-08T12:00:00.000Z';

  it('lavoura: aceita dataPlantio ISO', async () => {
    const dto: any = await validar(CreateLavouraDto, {
      nome: 'Talhão 1', cultura: 'Soja', areaHa: 80, dataPlantio: ISO, fazendaId: 'f1',
    });
    expect(dto.dataPlantio).toBe(ISO);
  });

  it('lavoura: continua recusando data inválida', async () => {
    await expect(
      validar(CreateLavouraDto, { nome: 'T', cultura: 'Soja', areaHa: 1, dataPlantio: 'ontem', fazendaId: 'f1' }),
    ).rejects.toThrow();
  });

  it('ocorrência: aceita data ISO', async () => {
    const dto: any = await validar(CreateOcorrenciaDto, { titulo: 'Febre', tipo: 'Sanidade', data: ISO });
    expect(dto.data).toBe(ISO);
  });

  it('financeiro (já era string): segue aceitando', async () => {
    const dto: any = await validar(CreateFinanceiroDto, {
      fazendaId: '8c1d2a4e-3b5f-4a6c-9d7e-0f1a2b3c4d5e', data: ISO, descricao: 'x', valor: 10, tipo: 'despesa',
    });
    expect(dto.data).toBe(ISO);
  });
});
