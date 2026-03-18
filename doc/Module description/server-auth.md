# 服务端认证模块

## 对应源码

- `server/src/auth/auth.module.ts`
- `server/src/auth/auth.controller.ts`
- `server/src/auth/auth.service.ts`
- `server/src/auth/jwt.strategy.ts`
- `server/src/auth/jwt-auth.guard.ts`
- `server/src/auth/public.decorator.ts`
- `server/src/auth/current-user.decorator.ts`
- `server/src/auth/email.service.ts`

## 模块职责

- 处理用户注册、邮箱验证码验证、验证码重发、登录、当前用户查询
- 生成并校验 JWT
- 为服务端其它业务模块提供统一的身份上下文
- 通过邮件服务发送注册验证码

## 对外接口

- `GET /auth/me`：返回当前登录用户
- `POST /auth/register`：注册并发送验证码
- `POST /auth/verify`：校验邮箱验证码并签发 token
- `POST /auth/resend-code`：重发验证码
- `POST /auth/login`：用户名密码登录

## 关键实现

- `auth.service.ts`
  - 负责密码哈希比对、用户创建、验证码校验、JWT 签发
- `jwt.strategy.ts` + `jwt-auth.guard.ts`
  - 负责请求鉴权，默认保护全部路由
- `public.decorator.ts`
  - 用于标记匿名可访问接口
- `current-user.decorator.ts`
  - 为控制器参数注入当前用户 ID
- `email.service.ts`
  - 使用 `SMTP_*` 配置发送验证码邮件

## 依赖方向

- 下游依赖 `database` 读写用户表
- 上游被 `board`、`habit`、`sync` 间接依赖，用于获取当前用户身份

## 边界说明

- 该模块只负责身份建立与鉴权链路
- 不负责具体业务数据的访问规则实现，业务所有权校验仍在各自服务内完成