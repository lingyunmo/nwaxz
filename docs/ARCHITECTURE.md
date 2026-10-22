# 架构说明

## 客户端

- `src/`：TypeScript 前端和样式，由 Vite 构建。
- `server/`：Express 服务端，提供构建产物、`/api/health` 和 `/api` 未实现接口的 404 响应。
- `public/`：静态公开资源，包括角色图集。
- `ops/`：部署辅助脚本。

Canvas 2D 游戏包含十二个关卡：第一章 `first-bath`（第一缸水）、`detour`（绕个小弯）、`last-drop`（曲曲折折）；第二章 `fan-crossing`、`valve-timing`；第三章 `clean-water-only`、`garden-gate`、`sponge-transfer`；第四章 `valve-wind-relay`、`sponge-relay`、`wind-sponge-relay`、`garden-wind-relay`。水流使用 208 粒子求解器，固定 120 Hz 步进并用空间分桶；可挖网格为 CELL8，石块不可挖。接到 100 滴清水即可获胜，泡泡币为额外收集目标。

普通12关与恐怖洗澡6关合计原18关，0.12.0 候选不改变它们。逃生篇在 0.11.0 已发布版本中使用 Canvas 2D 光线投射；0.12.0 的合并前候选将独立逃生渲染升级为 Babylon.js 9.32 / WebGL 真3D，主场景和角色模型由 `src/escape/renderer.ts`、`scene.ts`、`models.ts` 装配。玩家视角含上下 pitch；衣柜使用可开合门和可藏身的真实内腔；奶蛙有 idle、walk、run、laugh 四段骨骼动画，捧腹大笑保留为可见的核心动作。候选已通过无窗口 Chromium 软件渲染验收：900×650 和 390×844 视口、CDP 触控移动及上下转头、暂停时画面冻结、抓捕时3D大笑和下一夜、GLB 缓存及断网冷重载；脚本错误为0。此结果不代表真人手机帧率或扬声器听感已验证，低端手机性能和真机听感待测。0.12.0 的最终发布状态以对应 PR 的 CI 与公网核对为准。0.11.0 精确发布证据见[GitHub记录](https://github.com/lingyunmo/nwaxz/pull/34#issuecomment-6343588123)，发布记录另见 [VERIFICATION.md](VERIFICATION.md)。

0.12.0 本地候选使用 `public/assets/models/escape-props-v1.glb` 和 `public/assets/models/extreme-milk-frog-v1.glb`，由 `ops/build_escape_props.py` 与 `ops/build_escape_character.py` 生成。`public/assets/scenes/escape-materials-v1.webp` 等现有绘制纹理仍用于浴场表面和木材 UV；恐怖角色依据专用恐怖角色参考，不使用普通模式的 Cute turnaround。Vite PWA 预缓存 glob 包含 `.glb`，候选已通过 GLB 缓存和断网冷重载验收。浏览器验收入口是 `ops/escape-browser.mjs`：需独立安装 Playwright 或设置 `PLAYWRIGHT_MODULE`，`CHROMIUM_PATH` 可选；脚本固定以 headless 软件渲染和独立 profile 运行。

游戏包含主界面、普通模式章节选关、暂停、重来确认、结算和设置等完整流程。原生全屏只在浏览器支持时请求；不支持时游戏仍以全视口显示。计时在首次有效挖掘或操作机关时开始，暂停及页面进入后台时停止计时。得分公式为 `1000 + 500 × 泡泡币数 + max(0, 1000 - floor(elapsedMs / 100))`，最高 3500 分；最高分与最快时间分别合并。

进度保存在浏览器 IndexedDB，支持手动导入/导出，并通过 BroadcastChannel 合并同源标签页的存档。版本 1 旧存档仍可读取，缺失的成绩字段保持缺失，不推算旧分数。PWA 缓存静态资源并在更新可用时提示用户；每个 URL 仅登记一次，固定名称角色素材使用内容修订，只有 Vite 内容哈希文件长期缓存。预缓存清单排除三个已知 PNG 母版，但这些文件仍保留在 `public/` 并随站点构建到 `dist/`；运行时使用的 WebP 场景资源、两个逃生 GLB 和暂停用的 `wait.webp` 位于静态资源预缓存范围。更新缓存不会清空 IndexedDB。角色动画将原有 8 种和新增 4 种姿态平滑混合，并持续做呼吸摆动。美术素材见 [ART_V2.md](ART_V2.md)。

音乐与音效由 Web Audio 合成，音乐默认关闭；设置还包括震动、简化动作和画质选项。云端同步尚未实现。

机关包含局部风力、限量阀门、接触污染、水草吸收和多块海绵接力。`wind-sponge-relay` 复用暖暖水工坊场景：208 滴阀门以每秒 40 滴供水，容量 128 滴的海绵位于 `(108, 280)`；风扇将挤出的水推过高台。`garden-wind-relay` 也使用工坊场景，组合清水阀、污水阀、水草与风扇；清水阀提供 208 滴、40 滴/秒，污水阀提供 12 滴、12 滴/秒且 spread 为 0，水草位于 `(108, 312)`，碰撞区域为 `{x:76,y:248,w:64,h:64}`，耐受量为 12。玩家先用污水喂草使其枯萎，再打开清水阀并使用风扇把水推过高台。过早打开清水阀会使水被水草挡住，但仍可通过污水阀恢复；污水全部由水草吸收，不会污染清水。该关不改变 v1 存档结构。`FluidWorld` 保存机关状态、水源预算、清污类型、交付数、植物吸收量以及各海绵库存/队列；质量核对包含这些去向，挤水保留水种类并有短暂的原海绵重吸保护。Canvas 绘制透明道具并动画机关；DOM 按钮和键盘提供控制。污水进入浴缸时先判定失败，不写通关成绩。合法存档关卡 ID 从配置派生，v1 格式不变；前后端版本读取同一个 `package.json`。云端同步尚未实现。具体发布状态、历史 QA 和浏览器验证边界见 [VERIFICATION.md](VERIFICATION.md) 与 [DEVELOPMENT_STATE.md](DEVELOPMENT_STATE.md)。

原生 Node 测试覆盖关卡路线与泡泡币收集、机关条件、质量守恒、长帧处理、石块不可变和存档收敛。

## 运行方式

开发时 Vite 默认监听 `127.0.0.1:5173`，将 `/api` 代理至 `127.0.0.1:3000`。Express 默认监听 `127.0.0.1:3000`，通过 `PORT`、`HOST` 环境变量可调整监听参数。生产服务从 `dist/` 提供静态文件，`/api/health` 检查构建入口是否存在并返回版本及提交修订信息。

## 发布结构与范围

GitHub Actions 工作流执行 Verify、Build image、Deploy nwaxz。`main` 分支推送触发检查和按提交 SHA 构建 GHCR 镜像；只有仓库变量 `DEPLOY_ENABLED=true` 时才运行部署作业。部署目标为 `/root/minecraft/nwaxz` 中的 Compose 服务 `nwaxz-app`，加入已存在的外部 `common-net` 网络，容器内部端口 3000，不发布宿主机端口。

部署脚本使用 GHCR 不可变镜像 digest，在 `network none` 下运行候选镜像冒烟检查，再更新 nwaxz 服务并做健康检查；失败时尝试恢复原 nwaxz 镜像。不得执行 `docker compose down`、清理共享 Docker 资源或修改其他服务及共享网络。数据库迁移不得破坏现有数据。

外围变更仅新增 `nwaxz` 反向代理主机及 `nwaxz.bzlom.cn` DNS 记录。不得修改 `lom` 或其他生产服务、DNS、共享网络配置。源码仓库为公开仓库，main 分支保护已启用；修复版本的部署与公网验证记录见[发布验证](VERIFICATION.md)，配置边界见[部署说明](DEPLOYMENT.md)。
