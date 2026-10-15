# 架构说明

## 客户端

- `src/`：TypeScript 前端和样式，由 Vite 构建。
- `server/`：Express 服务端，提供构建产物、`/api/health` 和 `/api` 未实现接口的 404 响应。
- `public/`：静态公开资源，包括角色图集。
- `ops/`：部署辅助脚本。

Canvas 2D 游戏当前源码包含十个关卡：第一章 `first-bath`（第一缸水）、`detour`（绕个小弯）、`last-drop`（曲曲折折）；第二章 `fan-crossing`、`valve-timing`；第三章 `clean-water-only`、`garden-gate`、`sponge-transfer`；第四章 `valve-wind-relay`、`sponge-relay`。水流使用 208 粒子求解器，固定 120 Hz 步进并用空间分桶；可挖网格为 CELL8，石块不可挖。接到 100 滴清水即可获胜，泡泡币为额外收集目标。

游戏包含主界面、普通模式章节选关、暂停、重来确认、结算和设置等完整流程。原生全屏只在浏览器支持时请求；不支持时游戏仍以全视口显示。计时在首次有效挖掘或操作机关时开始，暂停及页面进入后台时停止计时。得分公式为 `1000 + 500 × 泡泡币数 + max(0, 1000 - floor(elapsedMs / 100))`，最高 3500 分；最高分与最快时间分别合并。

进度保存在浏览器 IndexedDB，支持手动导入/导出，并通过 BroadcastChannel 合并同源标签页的存档。版本 1 旧存档仍可读取，缺失的成绩字段保持缺失，不推算旧分数。PWA 缓存静态资源并在更新可用时提示用户；每个 URL 仅登记一次，固定名称角色素材使用内容修订，只有 Vite 内容哈希文件长期缓存。构建检查必需离线资源，缓存清单会随资源调整；角色动画将原有 8 种和新增 4 种姿态平滑混合，并持续做呼吸摆动。美术素材见 [ART_V2.md](ART_V2.md)。

音乐与音效由 Web Audio 合成，音乐默认关闭；设置还包括震动、简化动作和画质选项。云端同步尚未实现。

0.5.0 已按 PR 和自动部署流程发布，包含八关及水草、海绵机制。0.6.0 开发快照扩展到十关，新增第四章“暖暖水工坊”的组合机关关卡；发布前候选已完成本地浏览器验收，main 发布与公网 SHA 需独立核对。`valve-wind-relay` 组合限量阀门与风扇；`sponge-relay` 组合限量供水和双海绵接力。`FluidWorld` 保存机关状态、水源预算、清污类型、交付数、植物吸收量以及各海绵库存/队列；质量核对包含这些去向，挤水保留水种类并有短暂的原海绵重吸保护。Canvas 绘制透明道具并动画机关；DOM 按钮和键盘提供控制。污水进入浴缸时先判定失败，不写通关成绩。合法存档关卡 ID 从配置派生，v1 格式不变；前后端版本读取同一个 `package.json`。当前 `pnpm check` 的 36 项业务测试和 1 项 PWA 检查通过；发布与浏览器结果见 [VERIFICATION.md](VERIFICATION.md)，设计见 [GAME_DESIGN.md](GAME_DESIGN.md)，续做状态见 [DEVELOPMENT_STATE.md](DEVELOPMENT_STATE.md)。

原生 Node 测试覆盖关卡路线与泡泡币收集、机关条件、质量守恒、长帧处理、石块不可变和存档收敛。

## 运行方式

开发时 Vite 默认监听 `127.0.0.1:5173`，将 `/api` 代理至 `127.0.0.1:3000`。Express 默认监听 `127.0.0.1:3000`，通过 `PORT`、`HOST` 环境变量可调整监听参数。生产服务从 `dist/` 提供静态文件，`/api/health` 检查构建入口是否存在并返回版本及提交修订信息。

## 发布结构与范围

GitHub Actions 工作流执行 Verify、Build image、Deploy nwaxz。`main` 分支推送触发检查和按提交 SHA 构建 GHCR 镜像；只有仓库变量 `DEPLOY_ENABLED=true` 时才运行部署作业。部署目标为 `/root/minecraft/nwaxz` 中的 Compose 服务 `nwaxz-app`，加入已存在的外部 `common-net` 网络，容器内部端口 3000，不发布宿主机端口。

部署脚本使用 GHCR 不可变镜像 digest，在 `network none` 下运行候选镜像冒烟检查，再更新 nwaxz 服务并做健康检查；失败时尝试恢复原 nwaxz 镜像。不得执行 `docker compose down`、清理共享 Docker 资源或修改其他服务及共享网络。数据库迁移不得破坏现有数据。

外围变更仅新增 `nwaxz` 反向代理主机及 `nwaxz.bzlom.cn` DNS 记录。不得修改 `lom` 或其他生产服务、DNS、共享网络配置。源码仓库为公开仓库，main 分支保护已启用；修复版本的部署与公网验证记录见[发布验证](VERIFICATION.md)，配置边界见[部署说明](DEPLOYMENT.md)。
