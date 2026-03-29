# 基于区块链的慈善捐赠上链存证与安全管理系统

毕业设计项目，当前版本采用 `React + Vite + Go + SQLite + Hardhat + Solidity`。系统支持公益项目展示、捐赠记录存证、拨付追踪、链上校验、管理员审核，以及“项目申请者提交项目，管理员审核后上线”的流程。

## 当前架构

- `web`：React 前端
- `server`：Go 后端，正式运行目录
- `server-node-legacy`：旧版 Node/Express 后端，仅保留为历史参考
- `contracts`：智能合约、部署脚本、合约测试

当前前端默认代理到 Go 后端：

- 前端开发端口：`5173`
- 后端 API 端口：`4000`

## 角色与流程

系统内置 3 个主要角色：

- 管理员：审核项目、登记拨付、查看链记录与操作日志
- 捐赠者：浏览项目、提交捐赠、查看自己的捐赠与校验结果
- 项目申请者：提交项目申请，等待管理员审核通过后上线

业务流程：

1. 项目申请者提交项目申请。
2. 管理员审核项目，只有 `已通过` 的项目才会公开展示。
3. 捐赠者对已上线项目发起捐赠。
4. 系统生成业务哈希摘要，并将记录写入链上存证流程。
5. 管理员可登记拨付并追踪资金流向。
6. 用户可通过记录校验页和交易详情页查看链上信息。

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

默认提供的是本地 Hardhat 链演示配置。

### 3. 启动本地链

先启动 Hardhat 本地节点：

```bash
cd contracts
npm install
npm run node
```

再开一个终端部署合约：

```bash
cd contracts
npm run deploy -- --network localhost
```

将部署输出的合约地址写入根目录 `.env` 的 `CONTRACT_ADDRESS`。

### 4. 启动前后端

在项目根目录执行：

```bash
npm run demo
```

启动后访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:4000`
- 健康检查：`http://localhost:4000/api/health`

如果要分开启动：

```bash
npm run dev:server
npm run dev:web
```

## 演示账号

- 管理员：`admin@example.com` / `Admin123456`
- 普通用户（捐赠者）：`donor@example.com` / `Donor123456`
- 项目申请者：`applicant@example.com` / `Applicant123456`

Go 后端启动时会自动补齐演示用申请者账号。登录页也支持一键填充这 3 组演示账号。

## 默认页面入口

- 首页：`/`
- 项目大厅：`/projects`
- 链记录：`/chain-records`
- 链上校验：`/verify`
- 我的捐赠：`/my-donations`
- 我的项目申请：`/my-project-applications`
- 管理后台：首页 `/admin`

交易详情页支持直接通过哈希查看：

- `/transactions/:txHash`

## 状态说明

- `进行中`：项目当前可接受捐赠
- `已通过`：项目已审核通过并公开展示
- `已上链`：项目记录已成功写入链上

## 环境变量

常用配置如下，完整示例见 `.env.example`：

- `PORT`：Go 后端端口，默认 `4000`
- `JWT_SECRET`：登录签名密钥
- `DB_CLIENT`：当前仅实现 `sqlite`
- `DB_FILE`：SQLite 文件路径，默认 `data/app.db`
- `CHAIN_MODE`：`mock` / `local` / `sepolia`
- `RPC_URL`：本地链 RPC 地址
- `SEPOLIA_RPC_URL`：Sepolia RPC 地址
- `PRIVATE_KEY`：链上写入钱包私钥
- `CONTRACT_ADDRESS`：已部署合约地址

## 链模式

### `CHAIN_MODE=mock`

- 纯演示模式
- 不依赖真实链节点
- 不会生成可在浏览器中查询的真实交易

### `CHAIN_MODE=local`

- 连接本地 Hardhat 链
- 会生成真实的本地交易哈希
- 可通过系统内的交易详情页查看交易内容

### `CHAIN_MODE=sepolia`

- 连接 Sepolia 测试网
- 需要配置 `SEPOLIA_RPC_URL`、`PRIVATE_KEY`、`CONTRACT_ADDRESS`
- 交易可在 Etherscan 上查询

## 数据库说明

- 当前正式后端使用 `SQLite`
- 默认数据库文件：`server/data/app.db`
- 数据库迁移和演示账号初始化会在 Go 服务启动时自动执行

如果要重置演示库，可以删除：

```bash
rm -f server/data/app.db server/data/app.db-shm server/data/app.db-wal
```

然后重新启动 Go 后端。

## 常用命令

```bash
npm run demo
npm run dev:server
npm run dev:web
npm run build:web
npm run test:server
npm run test:contracts
```

## 文档

- SQLite 演示说明：`SQLITE_DEMO.md`
- 系统说明与答辩梳理：`docs/ARCHITECTURE.md`

## 当前实现重点

- Go 后端已替换旧版 Node 后端
- 前端已按角色重构为左侧导航工作区
- 项目申请者角色与审核上线流程已落地
- 交易详情页支持按 `txHash` 查看交易
- 管理后台支持项目审核、资金拨付、链记录管理、操作日志查看
