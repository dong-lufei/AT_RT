# 双 Token 认证系统

这是一个使用 Node.js 和 Express 实现的双 Token 认证系统示例。系统使用两个令牌：

1. **访问令牌 (Access Token)**:

   - 过期时间较短 (15 分钟)
   - 包含用户信息和权限
   - 用于访问受保护的资源

2. **刷新令牌 (Refresh Token)**:
   - 过期时间较长 (7 天)
   - 仅包含用户 ID
   - 用于获取新的访问令牌

## 项目结构

```
.
├── index.js          # 服务器入口文件
├── package.json      # 项目依赖配置
└── test.html        # 前端测试页面
```

## 安装和运行

1. 安装依赖:

   ```
   pnpm i
   ```

2. 启动服务器:

   ```
   pnpm start
   ```

   或者在开发模式下运行:

   ```
   pnpm dev
   ```

3. 打开 `index.html` 文件在浏览器中测试

## API 接口

### POST /auth/login

创建登录会话

**请求参数:**

```json
{
  "username": "admin",
  "password": "password123"
}
```

**响应（统一结构）:**

```json
{
  "code": 200,
  "msg": "登录成功",
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### POST /auth/refresh

刷新访问令牌

**请求参数:**

```json
{
  "refreshToken": "..."
}
```

**响应（统一结构）:**

```json
{
  "code": 200,
  "msg": "OK",
  "data": {
    "accessToken": "..."
  }
}
```

### GET /users

获取所有用户（受保护）

**请求头:**

```
Authorization: Bearer <accessToken>
```

**响应（统一结构）:**

```json
{
  "code": 200,
  "msg": "OK",
  "data": [
    {
      "id": 1,
      "username": "admin",
      "password": "password123",
      "role": "admin"
    },
    { "id": 2, "username": "user", "password": "user123", "role": "user" }
  ]
}
```

### GET /users/:id

获取单个用户详情（受保护）

**请求头:**

```
Authorization: Bearer <accessToken>
```

**响应（统一结构）:**

成功：

```json
{
  "code": 200,
  "msg": "OK",
  "data": {
    "id": 1,
    "username": "admin",
    "password": "password123",
    "role": "admin"
  }
}
```

未找到：

```json
{
  "code": 404,
  "msg": "用户不存在",
  "data": {}
}
```

## 测试账户

1. 管理员账户:

   - 用户名: `admin`
   - 密码: `password123`

2. 普通用户:
   - 用户名: `user`
   - 密码: `user123`
