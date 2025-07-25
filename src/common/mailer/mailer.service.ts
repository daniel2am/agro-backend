// src/common/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface SendMailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class MailerService {
  private transporter: Transporter;
  private readonly logger = new Logger(MailerService.name);

  constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      this.logger.error('Configuração SMTP ausente ou incompleta.');
      throw new Error('Configuração SMTP ausente ou incompleta.');
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465, // true apenas para porta 465
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  async send({ to, subject, text, html }: SendMailParams): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || `"AgroTotal" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });

      this.logger.log(`E-mail enviado para ${to}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail para ${to}`, error.stack);
      throw new Error('Falha no envio de e-mail.');
    }
  }
}
