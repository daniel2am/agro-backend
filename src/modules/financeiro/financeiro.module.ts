import { Module } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroController } from './financeiro.controller';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

@Module({
  controllers: [FinanceiroController],
  providers: [FinanceiroService, JwtStrategy],
})
export class FinanceiroModule {}