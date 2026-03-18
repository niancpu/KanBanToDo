# 客户端壳层模块

## 对应源码

- `client/src/main.ts`
- `client/src/App.vue`
- `client/src/router/index.ts`
- `client/src/plugins/vuetify.ts`
- `client/src/views/`
- `client/src/components/board/`
- `client/src/assets/`

## 模块职责

- 启动 Vue 应用并注册 Pinia、Router、Vuetify
- 在应用启动时恢复登录态，并为后续同步初始化创造条件
- 定义页面路由与登录拦截规则
- 组织页面级视图：日看板、习惯、日历、登录
- 提供看板场景下的界面组件，如卡片展示与卡片编辑弹窗
- 承载全局样式与 UI 框架接入

## 内部分层

- `main.ts`：应用启动入口，挂载应用并触发 `auth.restoreSession()`
- `router/index.ts`：路由表与前置守卫，未登录用户跳转到 `login`
- `views/`：页面容器，负责组合 store 与界面交互
- `components/board/`：日看板相关的复用组件，不负责持久化与同步
- `plugins/vuetify.ts`：UI 框架注册
- `assets/`：样式与静态资源

## 依赖方向

- 依赖 `client/src/stores/` 获取业务状态与动作
- 不直接承担 API、IndexedDB、同步协议细节
- 通过 `shared/src` 的类型与枚举保持界面字段一致性

## 边界说明

- 该模块负责“怎么展示和怎么导航”
- 不负责“数据从哪里来”和“如何同步到服务端”，这些属于 `client-state-and-sync.md`