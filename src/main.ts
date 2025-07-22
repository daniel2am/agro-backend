import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configura CORS se necessário (padrão: aberto para dev, ajustar depois se quiser)
  app.enableCors();

  // Documentação Swagger SEM IF (sempre ativa, inclusive em produção)
  const config = new DocumentBuilder()
    .setTitle('AgroTotal API')
    .setDescription('Documentação da API AgroTotal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Inicia aplicação
  await app.listen(process.env.PORT || 3333);
}
bootstrap();
