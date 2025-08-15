// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

// ✅ interop seguro para Node 22 (CJS/ESM)
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: ['error', 'warn', 'log'],
  });

  // CORS (Render + seu domínio + localhost/Expo)
  app.enableCors({
    origin: [
      /localhost:\d+$/,               // dev local
      /\.onrender\.com$/,             // Render
      /\.agrototalapp\.com\.br$/,     // seu domínio
      'exp://127.0.0.1:19000',        // Expo
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
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('AgroTotal API')
    .setDescription('Documentação da API AgroTotal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Confia no proxy (Render) para IPs reais
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Graceful shutdown (sinais do container)
  const onSignal = async (signal: string) => {
    try {
      // para de aceitar novas conexões e fecha Nest
      await app.close();
      const server = app.getHttpServer();
      server?.close?.();
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));

  // Sobe o HTTP server
  await app.listen(process.env.PORT || 3333);
}

bootstrap();