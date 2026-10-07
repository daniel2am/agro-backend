// src/health/health.controller.ts
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Vivo: barato, sem banco (usado pelo Render).
  @Get()
  ok() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  // Pronto: confere o banco. Aponte o monitor de uptime (UptimeRobot etc.) para cá.
  @Get('db')
  async db() {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ]);
      return { status: 'ok', db: 'ok', ts: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'erro', db: 'indisponivel' });
    }
  }
}
