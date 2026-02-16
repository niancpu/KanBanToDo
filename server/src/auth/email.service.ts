import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationCode(to: string, code: string) {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'KanBan ToDo — 邮箱验证码',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1976d2;">KanBan ToDo</h2>
          <p>你的验证码是：</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333; padding: 16px 0;">${code}</div>
          <p style="color: #666; font-size: 14px;">验证码 10 分钟内有效，请尽快完成验证。</p>
        </div>
      `,
    });
  }
}
