import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita CORS (ajuste depois se quiser restringir)
  app.enableCors();

  // Swagger SEM IF: sempre ativo!
  const config = new DocumentBuilder()
    .setTitle('AgroTotal API')
    .setDescription('Documentação da API AgroTotal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // <-- Aqui é '/api/docs'!

  // Sobe a aplicação na porta do ambiente ou 3333 local
  await app.listen(process.env.PORT || 3333);
}
bootstrap();
