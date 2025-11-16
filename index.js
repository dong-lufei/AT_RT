import express from "express"; // Web 框架
import jwt from "jsonwebtoken"; // JWT 令牌生成与验证
import bodyParser from "body-parser"; // 解析 JSON 请求体
import cors from "cors"; // 允许跨域请求
import fs from "fs"; // 读取 .env 配置
import path from "path"; // 处理文件路径
import os from "os"; // 获取本机网络地址

const app = express();
// 读取项目根目录下的 .env 配置
const ENV = (() => {
  const envPath = path.join(process.cwd(), ".env");
  const obj = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s || s.startsWith("#")) return;
      const i = s.indexOf("=");
      if (i > -1) {
        const k = s.slice(0, i).trim();
        const v = s.slice(i + 1).trim();
        obj[k] = v;
      }
    });
  }
  return obj;
})();
// 服务器端口与统一路由前缀（默认 /api）
const PORT = Number(ENV.PORT ?? 3001);
const BASE_PATH = ENV.BASE_PATH ?? "/";
const getAddresses = (port) => {
  const ifs = os.networkInterfaces();
  const lans = [];
  for (const name of Object.keys(ifs)) {
    for (const net of ifs[name] || []) {
      if (net.family === "IPv4" && !net.internal) lans.push(net.address);
    }
  }
  const local = `http://localhost:${port}`;
  return { local, lans: lans.map((ip) => `http://${ip}:${port}`) };
};
// 彩色打印接口列表
const printRoutesTable = (baseUrl, routes) => {
  console.log(color.info("METHOD") + "  " + color.info("URL"));
  routes.forEach((r) => {
    const methodColored = color.method(r.method.padEnd(6, " "));
    const url = `${baseUrl}${r.path}`;
    console.log(`${methodColored}  ${color.url(url)}`);
  });
};

// 模拟用户数据库（仅示例用途）
const users = [
  { id: 1, username: "admin", password: "password123", role: "admin" },
  { id: 2, username: "user", password: "user123", role: "user" },
];

// 令牌密钥配置
const ACCESS_TOKEN_SECRET =
  ENV.ACCESS_TOKEN_SECRET || "access_token_secret_key";
const REFRESH_TOKEN_SECRET =
  ENV.REFRESH_TOKEN_SECRET || "refresh_token_secret_key";

// 全局中间件：CORS、请求体解析、静态资源、统一响应结构、请求日志
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use((_req, res, next) => {
  const normalize = (d) => (d === null || d === undefined ? {} : d);
  res.sendResult = (data = {}, msg = "OK", code = 200) => {
    return res.json({ code, data: normalize(data), msg });
  };
  res.sendError = (msg = "Error", code = 500, data = {}) => {
    const status = code >= 100 && code < 600 ? code : 500;
    return res
      .status(status)
      .json({ code: status, data: normalize(data), msg });
  };
  next();
});
const color = {
  method: (m) => {
    switch (m) {
      case "GET":
        return `\x1b[32m${m}\x1b[0m`;
      case "POST":
        return `\x1b[36m${m}\x1b[0m`;
      case "PUT":
        return `\x1b[33m${m}\x1b[0m`;
      case "DELETE":
        return `\x1b[31m${m}\x1b[0m`;
      default:
        return `\x1b[35m${m}\x1b[0m`;
    }
  },
  path: (p) => `\x1b[95m${p}\x1b[0m`,
  url: (u) => `\x1b[36m${u}\x1b[0m`,
  info: (s) => `\x1b[93m${s}\x1b[0m`,
};
app.use((req, res, next) => {
  const d = new Date();
  const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds()
  ).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  console.log(`${ts} ${color.method(req.method)} ${color.path(req.path)}`);
  next();
});

// 生成访问令牌（短期有效）
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    ACCESS_TOKEN_SECRET,
    { expiresIn: "10s" } // 访问令牌过期时间改为10秒为了方便测试
  );
};

// 生成刷新令牌（长期有效）
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // 刷新令牌过期时间较长
  );
};

// 验证访问令牌中间件（受保护资源使用）
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendError("未授权", 401);
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    // console.log("🚀 ~ authenticateToken ~ err:", err);
    if (err) return res.sendError("访问令牌无效", 403);
    req.user = user;
    next();
  });
};

// 路由定义（RESTful 风格）
const router = express.Router();

// 认证：创建登录会话
router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.sendError("用户名不存在", 401);
  }
  if (user.password !== password) {
    return res.sendError("密码错误", 401);
  }
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.sendResult({ accessToken, refreshToken }, "登录成功");
});

// 认证：刷新访问令牌
router.post("/auth/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendError("缺少刷新令牌", 401);
  jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendError("刷新令牌无效", 403);
    const dbUser = users.find((u) => u.id === user.id);
    if (!dbUser) return res.sendError("用户不存在", 403);
    const newAccessToken = generateAccessToken(dbUser);
    res.sendResult({ accessToken: newAccessToken }, "OK");
  });
});

// 用户资源：获取所有用户（受保护）
router.get("/users", authenticateToken, (_req, res) => {
  return res.sendResult(users, "OK");
});

// 用户资源：获取单个用户详情（受保护，动态路由）
router.get("/users/:id", authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const user = users.find((u) => u.id === id);
  if (!user) return res.sendError("用户不存在", 404);
  return res.sendResult(user, "OK");
});

// 收集当前注册路由用于启动时打印
const collectRoutes = () => {
  const routes = [];
  router.stack.forEach((middleware) => {
    if (middleware.route) {
      const route = middleware.route;
      routes.push({
        method: Object.keys(route.methods)[0].toUpperCase(),
        path: BASE_PATH === "/" ? route.path : `${BASE_PATH}${route.path}`,
      });
    }
  });
  return routes;
};

// 启动服务器并打印地址与接口列表（支持点击）
app.use(BASE_PATH, router);
app.listen(PORT, () => {
  const { local, lans } = getAddresses(PORT);
  console.log(color.info("服务器地址:"));
  console.log(color.url(local));
  lans.forEach((addr) => console.log(color.url(addr)));
  const routes = collectRoutes();
  console.log(color.info("接口列表 (Local):"));
  printRoutesTable(local, routes);
  lans.forEach((addr, i) => {
    console.log(color.info(`接口列表 (LAN ${i + 1}):`));
    printRoutesTable(addr, routes);
  });
});
