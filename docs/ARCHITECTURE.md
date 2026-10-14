# 架构说明

## 客户端

- `src/`：TypeScript 前端和样式，由 Vite 构建。
- `server/`：Express 服务端，提供构建产物、`/api/health` 和 `/api` 未实现接口的 404 响应。
- `public/`：静态公开资源，包括角色图集。
- `ops/`：部署辅助脚本。

Canvas 2D 游戏包含三个关卡：`first-bath`（第一缸水）、`detour`（绕个小弯）、`last-drop`（曲曲折折）。水流使用 208 粒子求解器，固定 120 Hz 步进并用空间分桶；可挖网格为 CELL8，石块不可挖。胜利条件为收集 3 枚金币并接到 100 滴水。

进度保存在浏览器 IndexedDB，支持手动导入/导出，并通过 BroadcastChannel 合并存档。PWA 缓存静态资源并在更新可用时提示用户。角色透明图集位于 `public/assets/character/milk-frog-atlas.webp`，包含 idle、breath、blink、look、tap、laugh、celebrate 动作。当前没有音效。云端同步尚未实现。

原生 Node 测试覆盖三个关卡路线与全金币、质量守恒、长帧处理、石块不可变和存档收敛。

## 运行方式

开发时 Vite 默认监听 `127.0.0.1:5173`，将 `/api` 代理至 `127.0.0.1:3000`。Express 默认监听 `127.0.0.1:3000`，通过 `PORT`、`HOST` 环境变量可调整监听参数。生产服务从 `dist/` 提供静态文件，`/api/health` 检查构建入口是否存在并返回版本及提交修订信息。

## 发布结构与范围

GitHub Actions 工作流执行 Verify、Build image、Deploy nwaxz。`main` 分支推送触发检查和按提交 SHA 构建 GHCR 镜像；只有仓库变量 `DEPLOY_ENABLED=true` 时才运行部署作业。部署目标为 `/root/minecraft/nwaxz` 中的 Compose 服务 `nwaxz-app`，加入已存在的外部 `common-net` 网络，容器内部端口 3000，不发布宿主机端口。

部署脚本使用 GHCR 不可变镜像 digest，在 `network none` 下运行候选镜像冒烟检查，再更新 nwaxz 服务并做健康检查；失败时尝试恢复原 nwaxz 镜像。不得执行 `docker compose down`、清理共享 Docker 资源或修改其他服务及共享网络。数据库迁移不得破坏现有数据。

唯一获准的外围生产变更为新增 `nwaxz` 反向代理主机及 `nwaxz.bzlom.cn` DNS 记录。不得修改 `lom` 或其他生产服务、DNS、共享网络配置。详细配置见 [部署说明](DEPLOYMENT.md)。以上描述工作流及范围，不表示线上 DNS、代理、CI 或部署已经验证。
