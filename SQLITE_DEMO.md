# SQLite 演示版运行说明

这份文档用于“本地没有 MySQL，只想先把毕业设计页面跑起来”的场景。

## 1. 直接运行

在项目根目录执行：

```bash
npm install
cp .env.example .env
npm run db:init
npm run demo
```

启动后访问：

- 首页：`http://localhost:5173/`
- 登录页：`http://localhost:5173/login`
- 后台页：`http://localhost:5173/admin`
- 校验页：`http://localhost:5173/verify`

## 2. 默认配置

- 数据库：SQLite
- 数据库文件：`server/data/app.db`
- 链模式：`mock`
- 后端端口：`4000`
- 前端端口：`5173`

## 3. 默认账号

- 管理员：`admin@example.com` / `Admin123456`
- 普通用户：`donor@example.com` / `Donor123456`

## 4. 建议你先看的页面

### 首页

- 看项目卡片、筹款进度、最近链上存证记录

### 项目详情页

- 点进任意项目
- 可查看捐赠记录、资金流向、项目哈希
- 登录普通用户后可提交捐赠

### 管理后台

- 登录管理员账号进入
- 可创建项目、编辑项目、切换状态
- 可登记拨付记录
- 可查看链记录、失败重试、操作日志

### 链上校验页

- 输入捐赠记录 ID 或拨付记录 ID
- 查看链下重算哈希和链上哈希比对结果

## 5. 如果你只想分别启动

后端：

```bash
npm run dev:server
```

前端：

```bash
npm run dev:web
```

## 6. 演示顺序建议

1. 打开首页，展示项目总览。
2. 用普通用户登录，进入项目详情提交一笔捐赠。
3. 进入“我的捐赠”，点击“验证该记录”。
4. 切换管理员账号，进入后台创建项目或登记拨付。
5. 展示“链记录管理”和“操作日志”。

## 7. 常见问题

### 页面打不开

- 确认 `npm run demo` 是否还在运行
- 确认前端端口 `5173`、后端端口 `4000` 没被占用

### 登录失败

- 重新执行一次 `npm run db:init`
- 删除 `server/data/app.db` 后再执行 `npm run db:init`

### 不想用 SQLite

- 把 `.env` 里的 `DB_CLIENT=sqlite` 改成 `DB_CLIENT=mysql`
- 再按 MySQL 方案启动数据库
