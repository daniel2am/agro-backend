// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS (Render + domínio + localhost/Expo)
  app.enableCors({
    origin: [
      /localhost:\d+$/,
      /\.onrender\.com$/,
      /\.agrototalapp\.com\.br$/,
      'exp://127.0.0.1:19000',
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

  // Proxy (Render) para IP real
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  // Sobe servidor
  const server = await app.listen(process.env.PORT || 3333);

  // Graceful shutdown
  const shutdown = async () => {
    try {
      server.close?.();
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
bootstrap();