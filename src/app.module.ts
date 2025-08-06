import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { UsuarioModule } from './modules/usuario/usuario.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { FazendaModule } from './modules/fazenda/fazenda.module';
import { AnimalModule } from './modules/animal/animal.module';
import { MedicamentoModule } from './modules/medicamento/medicamento.module';
import { OcorrenciaModule } from './modules/ocorrencia/ocorrencia.module';
import { HistoricoModule } from './modules/historico/historico.module';
import { CompraInsumoModule } from './modules/compra-insumo/compra-insumo.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InvernadaModule } from './modules/invernada/invernada.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { LavouraModule } from './modules/lavoura/lavoura.module';
import { LeituraDispositivoModule } from './modules/leitura-dispositivo/leitura-dispositivo.module';
import { ManejoModule } from './modules/manejo/manejo.module';
import { MarcaModeloModule } from './modules/modelo-dispositivo/marca-modelo.module';
import { PesagemModule } from './modules/pesagem/pesagem.module';
import { SanidadeModule } from './modules/sanidade/sanidade.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ...existing code...
    UsuarioModule,
    SanidadeModule,
    PesagemModule,
    MarcaModeloModule,
    FazendaModule,
    ManejoModule,
    LeituraDispositivoModule,
    LavouraModule,
    DashboardModule,
    OcorrenciaModule,
    MedicamentoModule,
    AnimalModule,
    HistoricoModule,
    CompraInsumoModule,
    InvernadaModule,
    FinanceiroModule,
    AuthModule,
    JwtModule.register({}),
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT, 10),
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        defaults: {
          from: process.env.SMTP_FROM,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
