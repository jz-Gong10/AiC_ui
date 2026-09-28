# CullPilot 前端

根据 `doc/ui` 的设计预览实现的 Web 工作台。工作区对应后端项目；业务数据经 `/api/v1` 从 Spring Boot 读取，前端不会向 Python 服务直接请求。

## 本地启动

需要 Node 24、npm，以及运行在 `http://localhost:8080` 的 `AiC_server/backend-java`。

```powershell
cd AiC_ui
npm ci
npm run dev
```

浏览器打开 `http://localhost:5173`。Vite 将 `/api` 代理到本机后端。若部署环境的 API 地址不同，可设置公开的 `VITE_API_BASE_URL`；不要放入任何服务端密钥。生产检查使用 `npm run typecheck`、`npm run lint`、`npm run build`。静态产物在 `dist/`，SPA 路由需要部署端回落到 `index.html`，`/api` 仍应转发给 Java 服务。

如果只想本地预览，无须启动后端：在登录页点击“进入本地演示（无需登录）”。仅 Vite 开发模式且浏览器地址为 `localhost`、`127.0.0.1` 或 `::1` 时显示此入口。演示提供两个工作区、示意图片、相似照片分组、人工筛选及创建工作区等交互；新增素材保留在当前页面内存中，刷新后所有演示改动重置。演示分析不会调用 AI，导出不可用。正常登录依然使用真实后端；生产构建没有可用的演示入口或模拟 API。

## 已接入

- 注册、登录、当前用户、退出登录；访问令牌保存在当前浏览器标签会话中。
- 多工作区创建、切换、设置、删除，以及照片分页浏览。
- JPEG/PNG/WebP 批量上传，按最多 10 张且总计不超过 100 MiB 分批；展示进度、重复和失败数量。
- 启动、查询、取消、重试分析任务；在任务完成后刷新素材与汇总。
- 人工保留、待确认和舍弃；更新时提交服务端返回的 `version`，冲突后重新读取。
- 单图、双图、总览布局，后端缩略图与原图鉴权读取，导出任务与 ZIP 下载。
- 25 种主题色、15 种组件配方、3 种照片布局、深浅色；外观保存在本机浏览器。平台相关的偏好与下载能力经 `PlatformAdapter`，便于后续接 Electron。

## 当前接口边界

Apifox 的 **CullPilot** 项目（ID `8884039`）含 25 个接口，前端请求字段以该项目与仓库 `AiC_server` 源码核对。Apifox 记录了 `GET /projects/{projectId}/groups` 和 `GET /groups/{groupId}/assets`：前端已经具备读取、按 `groupType` 分类、照片叠与展开的组件；当前 Java 源码没有这两个 Controller，分析器的分组、质量和排序也是扩展点。因此现有后端运行时通常显示“暂无分组结果”，不会伪造相似度、质量分或推荐。

自然语言解析与重排也没有可调用的 Java 接口。对话区明确提示未接入，输入只在当前页面会话内按工作区保存，不会更改推荐或人工决定。结构化筛选设置会真实保存，但当前后端尚不能据此重排。组内展开支持 Apifox 的分页契约，当前一次展示最多 100 张，并明确提示尚有更多成员。

账号与项目数据属于实际后端。与 [静态外观预览](../doc/ui/cullpilot-design-preview.html) 不同，此工程不会自动加载示例照片。

## 目录

- `src/app`：路由、鉴权、工作区和任务界面。
- `src/shared`：API、DTO、错误处理与鉴权图片读取。
- `src/features/review`：照片网格、照片叠、人工复核、单图和双图布局。
- `src/appearance`：外观配置与本地保存。
- `src/platform`：浏览器平台实现和 Electron 可替换接口。

本机端到端检查使用 `temp/` 下的隔离 SQLite 数据库和浏览器配置，不写入正式工作区。
