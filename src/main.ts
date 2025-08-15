// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: ['error', 'warn', 'log'], // ajuste se quiser
  });

  // CORS mais controlado (Render + seu domínio + localhost)
  app.enableCors({
    origin: [
      /localhost:\d+$/,                          // dev local
      /\.onrender\.com$/,                        // backend no Render
      /\.agrototalapp\.com\.br$/,                // seu domínio
      'exp://127.0.0.1:19000',                   // Expo (ajuste conforme necessário)
      'http://127.0.0.1:19006',
      'http://localhost:19006',
    ],
    credentials: true,
  });

  // Segurança e performance
  app.use(helmet());
  app.use(compression());

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,                 // ativa @Type etc.
      whitelist: true,                 // remove props extras
      forbidNonWhitelisted: false,     // se quiser 400 ao enviar campos a mais => true
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Prefixo opcional (bom pra versionar)
  // app.setGlobalPrefix('v1');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('AgroTotal API')
    .setDescription('Documentação da API AgroTotal')
    .setVersion('1.0')
    .addBearerAuth() // padrão 'bearer'
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Graceful shutdown (Prisma pega o hook via enableShutdownHooks)
  app.enableShutdownHooks();

  // Se estiver atrás de proxy (Render), confiar no proxy ajuda em IP real
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  await app.listen(process.env.PORT || 3333);
  
  // ao final do bootstrap, depois de app.listen:
const server = await app.listen(process.env.PORT || 3333);

// graceful shutdown
const shutdown = async (signal: string) => {
  try {
    // fecha HTTP primeiro (para parar de aceitar requests)
    server.close?.();
    // Nest fechará módulos; Prisma desconecta em onModuleDestroy()
    await app.close();
  } finally {
    process.exit(0);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();