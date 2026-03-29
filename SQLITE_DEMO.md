# SQLite 演示版运行说明

这份文档用于“直接跑演示，不接 MySQL，只用本地 SQLite 和 Hardhat 本地链”的场景。

## 1. 推荐演示方式

### 启动本地链

终端 1：

```bash
cd contracts
npm install
npm run node
```

终端 2：

```bash
cd contracts
npm run deploy -- --network localhost
```

将部署得到的合约地址写入根目录 `.env` 的 `CONTRACT_ADDRESS`。

### 启动系统

终端 3：

```bash
cd /path/to/lw
npm install
cp .env.example .env
npm run demo
```

## 2. 默认配置

- 数据库：SQLite
- 数据库文件：`server/data/app.db`
- 链模式：`local`
- 后端端口：`4000`
- 前端端口：`5173`

## 3. 演示账号

- 管理员：`admin@example.com` / `Admin123456`
- 普通用户：`donor@example.com` / `Donor123456`
- 项目申请者：`applicant@example.com` / `Applicant123456`

## 4. 建议演示顺序

1. 先用游客身份打开首页和项目大厅，展示系统目标与公开项目。
2. 用项目申请者登录，进入“我的项目申请”，提交一个新项目。
3. 切换管理员登录，在“项目审核”中审批该项目。
4. 再切换普通用户登录，对已通过项目发起捐赠。
5. 打开“我的捐赠”或交易详情页，展示哈希与链上校验。
6. 切换管理员，登记一笔拨付并展示操作日志、链记录管理。

## 5. 关键页面

- 首页：`http://localhost:5173/`
- 登录页：`http://localhost:5173/login`
- 项目大厅：`http://localhost:5173/projects`
- 我的项目申请：`http://localhost:5173/my-project-applications`
- 我的捐赠：`http://localhost:5173/my-donations`
- 链上校验：`http://localhost:5173/verify`
- 管理后台：`http://localhost:5173/admin`

## 6. 状态解释

- `进行中`：项目处于募捐期，可继续接受捐赠
- `已通过`：项目已通过管理员审核，可对外公开
- `已上链`：记录摘要已经写入链上

## 7. 常见问题

### 页面打不开

- 确认 `npm run demo` 是否在运行
- 确认 `5173` 和 `4000` 端口未被占用

### 登录失败

- 先确认数据库是否已初始化
- 如需重置，删除 `server/data/app.db*` 后重新启动服务

### 看不到交易哈希

- 确认 `.env` 中不是 `CHAIN_MODE=mock`
- 如果是 `CHAIN_MODE=local`，应先启动 Hardhat 节点并部署合约

### 哈希点开后不是 Etherscan

- 本地链模式下不会跳转 Etherscan
- 本项目提供 `/transactions/:txHash` 本地交易详情页用于演示

## 8. 如果只想分别启动

```bash
npm run dev:server
npm run dev:web
```
