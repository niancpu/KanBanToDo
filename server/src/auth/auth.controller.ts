import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: { username: string; password: string; email: string }) {
    return this.authService.register(body.username, body.password, body.email);
  }

  @Public()
  @Post('verify')
  verify(@Body() body: { email: string; code: string }) {
    return this.authService.verify(body.email, body.code);
  }

  @Public()
  @Post('resend-code')
  resendCode(@Body() body: { email: string }) {
    return this.authService.resendCode(body.email);
  }

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password?: string }) {
    return this.authService.login(body.username, body.password);
  }
}
