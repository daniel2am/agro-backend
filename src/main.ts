// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // 🔴 Importante: validação + transformação + whitelist
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,            // ativa @Type(() => Number), etc
      whitelist: true,            // remove props não declaradas no DTO
      forbidNonWhitelisted: true, // 400 se vier campo extra
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('AgroTotal API')
    .setDescription('Documentação da API AgroTotal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3333);
}
bootstrap();