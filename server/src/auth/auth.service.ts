import { Injectable, Inject, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DB } from '../database/database.module';
import { users } from '../database/schema';
import { v4 as uuid } from 'uuid';
import { EmailService } from './email.service';

const ADMIN_USERNAME = '一念';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private db: any,
    private jwt: JwtService,
    private emailService: EmailService,
  ) {}

  async register(username: string, password: string, email: string) {
    if (username === ADMIN_USERNAME) throw new BadRequestException('该用户名已被保留');

    const [existing] = await this.db.select().from(users).where(eq(users.username, username));
    if (existing) throw new ConflictException('用户名已存在');

    const hash = await bcrypt.hash(password, 10);
    const id = uuid();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.insert(users).values({
      id, username, passwordHash: hash, email,
      emailVerified: false, verificationCode: code, verificationCodeExpires: expires,
    });

    await this.emailService.sendVerificationCode(email, code);
    return { needVerification: true };
  }

  async verify(email: string, code: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    if (!user) throw new BadRequestException('邮箱不存在');
    if (user.emailVerified) return this.signToken(user.id, user.username);
    if (user.verificationCode !== code) throw new BadRequestException('验证码错误');
    if (!user.verificationCodeExpires || new Date() > user.verificationCodeExpires) {
      throw new BadRequestException('验证码已过期，请重新注册');
    }

    await this.db.update(users).set({
      emailVerified: true, verificationCode: null, verificationCodeExpires: null,
    }).where(eq(users.id, user.id));

    return this.signToken(user.id, user.username);
  }

  async resendCode(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    if (!user) throw new BadRequestException('邮箱不存在');
    if (user.emailVerified) throw new BadRequestException('邮箱已验证');

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await this.db.update(users).set({ verificationCode: code, verificationCodeExpires: expires }).where(eq(users.id, user.id));
    await this.emailService.sendVerificationCode(email, code);
    return { sent: true };
  }

  async login(username: string, password?: string) {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));

    // 管理员：用户名 + 密码（首次登录自动写入 hash）
    if (username === ADMIN_USERNAME) {
      if (!user) throw new UnauthorizedException('用户不存在');
      if (!password) throw new UnauthorizedException('请输入密码');
      if (!user.passwordHash) {
        const hash = await bcrypt.hash(password, 10);
        await this.db.update(users).set({ passwordHash: hash }).where(eq(users.id, user.id));
        return this.signToken(user.id, user.username);
      }
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('密码错误');
      }
      return this.signToken(user.id, user.username);
    }

    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('邮箱未验证，请先完成验证');
    }
    return this.signToken(user.id, user.username);
  }

  private signToken(userId: string, username: string) {
    const access_token = this.jwt.sign({ sub: userId, username });
    return { access_token, user: { id: userId, username } };
  }
}
