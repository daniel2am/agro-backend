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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ...existing code...
    UsuarioModule,
    FazendaModule,
    OcorrenciaModule,
    MedicamentoModule,
    AnimalModule,
    HistoricoModule,
    CompraInsumoModule,
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
