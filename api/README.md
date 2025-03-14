# CookieCloud API

这是CookieCloud的API服务器，用于存储和获取加密的Cookie数据。

## 本地开发

1. 安装依赖：
```bash
npm install
# 或
yarn install
```

2. 启动开发服务器：
```bash
npm run dev
# 或
yarn dev
```

服务器将在 http://localhost:8088 上运行。

## Vercel部署指南

1. 安装Vercel CLI（如果尚未安装）：
```bash
npm install -g vercel
```

2. 登录Vercel：
```bash
vercel login
```

3. 部署项目：
```bash
vercel
```

4. 生产环境部署：
```bash
vercel --prod
```

## API接口

- `POST /update`: 更新加密数据
- `GET /get/:uuid`: 获取加密数据

## 环境变量

- `PORT`: 服务器端口（默认：8088）
- `API_ROOT`: API根路径前缀（可选） 