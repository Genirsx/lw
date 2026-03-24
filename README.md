# 基于区块链的慈善捐赠上链存证与安全管理系统

毕业设计原型项目，采用 `React + Express + SQLite/MySQL + Hardhat + Solidity` 实现公益项目展示、捐赠记录存证、资金流向追踪、操作日志与链上校验。默认使用 `SQLite + mock chain`，不需要额外安装数据库就能直接演示前端页面；后续也可以切换为 MySQL 或真实链节点。

## 目录结构

- `contracts`：智能合约、部署脚本、合约测试
- `server`：后端 API、数据库初始化、链服务
- `web`：React 前端

## 快速启动

```bash
npm install
cp .env.example .env
npm run db:init
npm run demo
```

默认会同时启动前端和后端：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:4000`

如果你想分开启动：

```bash
npm run dev:server
npm run dev:web
```

## 默认账号

- 管理员：`admin@example.com` / `Admin123456`
- 普通用户：`donor@example.com` / `Donor123456`

## 数据库

- 默认使用 SQLite，本地文件位于 `server/data/app.db`
- 初始化 SQLite：`npm run db:init`
- 若需要切换 MySQL，可把 `.env` 中 `DB_CLIENT` 改为 `mysql`，然后使用 `npm run db:up` 和 `npm run db:init`
- MySQL 容器配置在 [docker-compose.yml](/home/genirs/lw/docker-compose.yml)

## 前端页面

- 首页：`http://localhost:5173/`
- 登录页：`http://localhost:5173/login`
- 注册页：`http://localhost:5173/register`
- 我的捐赠：`http://localhost:5173/my-donations`
- 链上校验：`http://localhost:5173/verify`
- 管理后台：`http://localhost:5173/admin`

更完整的演示说明见 [SQLITE_DEMO.md](/home/genirs/lw/SQLITE_DEMO.md)。

## 链模式

- `CHAIN_MODE=mock`：本地演示模式，不依赖区块链节点，会生成模拟交易哈希与链上状态
- `CHAIN_MODE=local`：连接本地 Hardhat 节点
- `CHAIN_MODE=sepolia`：连接 Sepolia 测试网

## MetaMask Sepolia 配置

将 Sepolia 网络添加到 MetaMask 时可使用：

- Network name：`Ethereum Sepolia`
- New RPC URL：`https://ethereum-sepolia-rpc.publicnode.com`
- Chain ID：`11155111`
- Currency symbol：`ETH`
- Block explorer URL：`https://sepolia.etherscan.io`

如果你已经把 `PRIVATE_KEY` 和 `CONTRACT_ADDRESS` 写入 `.env`，再把：

- `CHAIN_MODE=sepolia`
- `SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY`

写好后，后端提交记录时就会走 Sepolia。前端的校验页、首页最近链记录、后台链记录管理页也会显示对应的 Etherscan 跳转链接。

## Hardhat 部署到 Sepolia

`.env` 至少需要：

- `PRIVATE_KEY=你的部署钱包私钥`
- `INFURA_API_KEY=你的 Infura Project ID`

或者直接写：

- `SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY`

部署命令：

```bash
cd contracts
npm run deploy -- --network sepolia
```

部署成功后，地址会输出到终端，并写入 `contracts/deployments/sepolia.json`。

## 合约部署

```bash
cd contracts
npm run compile
npm run test
npm run node
```

另开一个终端：

```bash
cd contracts
npm run deploy -- --network localhost
```

将部署后的合约地址写入根目录 `.env` 的 `CONTRACT_ADDRESS`，并把 `CHAIN_MODE` 改为 `local`。

## 当前已实现的后台增强

- 管理员项目列表、项目编辑、项目状态切换
- 捐赠/链记录/日志分页查询
- 失败上链重试
- 管理员操作日志

## 论文可描述的技术点

- 捐赠记录、项目记录、拨付记录的规范化哈希生成
- 链下业务数据与链上存证摘要的协同
- Solidity 合约访问控制与事件设计
- 基于角色的后台权限管理
- 捐赠记录可验证展示与资金流向追踪
