# Smart AI - 智能AI应用平台

这是一个功能丰富的全栈 AI 应用平台，集成了 AI 模型调用、内容管理、用户社区和商业化支付功能。前端采用 Vue 3 和 Arco Design，后端采用 Node.js/Express 和 MongoDB。

## ✅ 已完成功能清单

### 1. 核心框架
- **用户中心**:
  - 支持邮箱注册、登录、登出
  - JWT (JSON Web Token) 无状态认证
  - 用户个人信息查询与修改
  - Bcrypt 密码加密存储
- **权限管理**:
  - 基于角色的访问控制 (RBAC)
  - 菜单与 API 接口权限分配
  - 动态路由生成
- **文件服务**:
  - `multer` 实现文件上传
  - 媒体资源代理，隐藏真实文件源

### 2. AI 功能
- **AI 应用管理**:
  - 创建、编辑、删除 AI 应用
  - 管理应用的参数、分类和标签
- **模型集成**:
  - 已集成 `ComfyUI`，提供统一的调用接口
  - 支持 `text-to-image`, `image-to-image` 等多种 AI 类型
- **AI 小部件 (Widget)**:
  - 可嵌入的 AI 功能组件

### 3. 内容与社区 (CMS)
- **内容管理**:
  - 文章、独立页面、公告的增删改查
  - 支持分类和标签管理
- **社区互动**:
  - 用户作品 (`Works`) 发布与展示
  - 灵感分类，聚合优质内容
  - 公开作品市场，可浏览他人作品

### 4. 商业化与管理后台
- **积分系统**:
  - 用户积分账户
  - 积分充值与消费记录
  - 后台积分调整与设置
- **系统设置**:
  - 强大的后台管理面板
  - 全局枚举类型与配置管理
  - 平台信息、菜单、通知等动态配置

## 🚀 技术栈

- **前端**:
  - 框架: **Vue.js 3**
  - UI 库: **Arco Design Vue**
  - 构建工具: **Vite**
  - 路由: **Vue Router**
  - HTTP 请求: **Axios**
- **后端**:
  - 框架: **Express.js**
  - 数据库: **MongoDB** (使用 **Mongoose**)
  - 认证: **JSON Web Tokens (JWT)**
  - 密码加密: **Bcrypt**
  - 邮件服务: **Nodemailer**

## 🛠️ 部署指南

### 先决条件

- [Node.js](https://nodejs.org/) (v18.x 或更高版本)
- [npm](https://www.npmjs.com/) / [yarn](https://yarnpkg.com/) / [pnpm](https://pnpm.io/)
- [MongoDB](https://www.mongodb.com/) 数据库实例

### 1. 数据库设置

1.  确保你有一个正在运行的 MongoDB 实例 (本地或云端，如 MongoDB Atlas)。
2.  获取你的 MongoDB 连接字符串 (Connection URI)。

### 2. 后端部署

1.  进入后端目录：
    ```bash
    cd backend
    ```
2.  安装依赖：
    ```bash
    npm install
    ```
3.  在 `backend` 目录下创建一个名为 `.env` 的文件，并添加以下内容，将 `your_mongodb_connection_string` 替换为你的真实连接字符串：
    ```env
    MONGO_URI=your_mongodb_connection_string
    ```
4.  启动后端服务：
    ```bash
    npm start
    ```
5.  后端服务将在 `index.js` 中配置的端口上启动。

### 3. 前端部署

1.  进入前端目录：
    ```bash
    cd frontend
    ```
2.  安装依赖：
    ```bash
    npm install
    ```
3.  构建前端应用：
    ```bash
    npm run build:all
    ```
4.  构建产物将生成在 `frontend/dist/` 目录下。
5.  将 `dist` 目录下的静态文件部署到任何静态网站托管服务（如 Nginx, Vercel, Netlify）。
6.  **重要**: 你需要配置一个反向代理 (例如使用 Nginx)，将前端的 API 请求 (通常是 `/api` 前缀) 转发到正在运行的后端服务地址，以避免跨域问题。

## 📝 未来计划 (待办清单)

- [ ] **用户作品管理**:
    - [ ] 在管理后台增加对用户生成作品的查看、审核与管理功能。
    - [ ] 增加用户生成历史记录页面，方便用户追溯。
- [ ] **AI 平台扩展**:
    - [ ] 抽象 AI 平台接口，支持快速接入除 `ComfyUI` 外的其他 API (如 Stable Diffusion WebUI, Midjourney, DALL-E 3 等)。
    - [ ] 在前端实现不同 AI 平台的参数配置界面。
- [ ] **支付系统完善**:
    - [ ] 设计并实现完整的支付流程，而不仅是积分配置。
    - [ ] 接入至少一种主流第三方支付网关 (如支付宝、微信支付、Stripe)。
- [ ] **测试与文档**:
    - [ ] 为核心 API 和组件编写单元测试和集成测试。
    - [ ] 使用 Swagger 或 OpenAPI 规范为后端生成交互式 API 文档。
- [ ] **部署与运维**:
    - [ ] 建立 CI/CD 自动化部署流水线。
    - [ ] 引入日志、监控和告警系统 (如 ELK Stack, Prometheus, Grafana)。 