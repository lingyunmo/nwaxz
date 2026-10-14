# 奶娃爱洗澡（nwaxz）

面向手机浏览器的 H5 挖水解谜游戏。划开泥土，让水流进入奶娃的浴缸。

## 当前功能

- Canvas 2D 三关：`first-bath`（第一缸水）、`detour`（绕个小弯）、`last-drop`（曲曲折折）。
- 208 粒子水流求解器，采用固定 120 Hz 步进和空间分桶；挖掘网格单元为 CELL8，石块不可挖。
- 每关接到 100 滴水即可获胜，可额外收集 3 枚泡泡币。
- 浏览器 IndexedDB 本地存档，支持导入/导出；通过 BroadcastChannel 合并存档。
- PWA 静态资源缓存和提示式更新。
- 透明角色图集 `public/assets/character/milk-frog-atlas.webp`，包含 idle、breath、blink、look、tap、laugh、celebrate 动作。

三关均已在公网 Chrome 实际通关，每关获得 3/3 泡泡币，刷新后存档仍保留 3/3。修复版本也已通过公网离线复测：断网重载可打开完整游戏、角色和 3/3 本机存档，并能离线通关第一关（100/100 水、3/3 泡泡币）。当前没有音效；云端同步仍是后续计划，尚未实现。

线上游戏：[立即游玩](https://nwaxz.bzlom.cn)。修复版本的代码、部署与离线验证证据见[发布验证记录](docs/VERIFICATION.md)；未来提交需要按各自工作流结果单独确认。

## 技术栈

前端使用 TypeScript、Vite、Canvas 2D；服务端使用 Node.js 24 和 Express 5；包管理器为 pnpm 11.1.3。

## 本地开发

需要 Node.js `>=24.15.0 <25` 和 pnpm 11.1.3。

```sh
pnpm install
pnpm dev
```

开发服务器默认监听 `127.0.0.1:5173`。需要 API 时另开终端运行 `pnpm dev:server`（默认 `127.0.0.1:3000`）；Vite 将 `/api` 代理到本地服务端。

```sh
pnpm test       # Node 原生测试
pnpm build      # TypeScript 检查、Vite 构建及离线清单回归检查
pnpm check      # test + build
pnpm start      # 启动服务端
pnpm smoke      # HTTP 冒烟检查
```

原生测试覆盖三个关卡的路线与全金币、质量守恒、长帧处理、石块不可变和存档收敛。运行 `pnpm check` 可在本地复现测试及构建检查；最近一次发布的具体结果见[验证记录](docs/VERIFICATION.md)。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [部署说明](docs/DEPLOYMENT.md)
- [贡献指南](CONTRIBUTING.md)
- [安全问题报告](SECURITY.md)

源码仓库：[lingyunmo/nwaxz](https://github.com/lingyunmo/nwaxz)（公开）。
