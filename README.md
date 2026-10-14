# 奶蛙爱洗澡（nwaxz）

面向手机浏览器的 H5 挖水解谜游戏。划开泥土，让水流进入奶蛙的浴缸。

## 当前功能

- 已发布版本为 0.4.0，包含六关及清污分流基础机制。线上版本以 [发布验证记录](docs/VERIFICATION.md) 中最近核对的 main SHA 和 Actions 运行为准。
- 当前 0.5.0 开发快照含八关：第一章 `first-bath`（第一缸水）、`detour`（绕个小弯）、`last-drop`（曲曲折折）；第二章 `fan-crossing`、`valve-timing`；第三章 `clean-water-only`、`garden-gate`、`sponge-transfer`。后两关已完成本地浏览器验收，发布以对应 Actions 与公网修订为准。
- 基础清水源包含 208 滴的粒子水流求解器，采用固定 120 Hz 步进和空间分桶；挖掘网格单元为 CELL8，石块不可挖。
- 第二章加入可交互风扇和限量喷水阀：打开风扇可改变局部水流，阀门按固定流速消耗有限水量。
- 清污分流：污水池生成 64 滴紫色污水；水滴接触会传播污染，污水不能收集泡泡币或计入清水进度。污水流入浴缸会失败并可重试，失败局不保存成绩。
- 当前开发快照新增水草与海绵：水草阻挡清水、吸收最多 12 滴污水后枯萎；先开污水阀（12 滴、spread 0），再开清水阀（208 滴），可用屏幕按钮或 `B`/`V`。海绵容量 160 滴，点击或按 `E` 将库存放入队列，以每秒 80 滴向下挤出并保留水的种类；释放后 1 秒内不会被原海绵立即吸回。水量守恒统计包含植物吸收、海绵库存和待释放队列。发布状态见验证记录。
- 每关接到 100 滴水即可获胜，可额外收集 3 枚泡泡币。
- 成绩包含分数和用时；计时从首次有效挖土或操作机关开始，暂停及后台不计时。最高分与最快用时独立合并；旧版 v1 存档可继续读取，旧纪录不会补造分数。
- 浏览器 IndexedDB 本地存档，支持导入/导出；通过 BroadcastChannel 合并存档。
- 设置包含音乐、音效、震动、简化动作和画质选项。音效和轻音乐由 Web Audio 合成，音乐默认关闭，不使用外部录音。
- PWA 静态资源缓存和提示式更新；构建会检查必需离线资源，离线能力以实际浏览器测试为准。
- 透明角色图集 `public/assets/character/milk-frog-atlas.webp`，包含 idle、breath、blink、look、tap、laugh、celebrate 动作。
- 12 种角色姿态（原有 8 种及新增 4 种），姿态间平滑混合并连续呼吸摆动。

0.5.0 开发快照 `pnpm check` 通过 31 项业务测试和 1 项 PWA 检查；八关模拟路线均以半径 25 挖掘并收齐泡泡币。新增水草、海绵关已在本地浏览器全币通关，并完成触控、键盘、暂停和离线验收。云端同步尚未实现。

线上游戏：[立即游玩](https://nwaxz.bzlom.cn)。版本与 QA 状态见 [DEVELOPMENT_STATE.md](docs/DEVELOPMENT_STATE.md)，玩法说明见 [GAME_DESIGN.md](docs/GAME_DESIGN.md)，已核对的发布证据见 [验证记录](docs/VERIFICATION.md)。绘制资源见 [ART_V2.md](docs/ART_V2.md) 和 [ART_PROPS.md](docs/ART_PROPS.md)。

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
- [开发状态与后续计划](docs/DEVELOPMENT_STATE.md)
- [游戏设计](docs/GAME_DESIGN.md)
- [部署说明](docs/DEPLOYMENT.md)
- [贡献指南](CONTRIBUTING.md)
- [安全问题报告](SECURITY.md)

源码仓库：[lingyunmo/nwaxz](https://github.com/lingyunmo/nwaxz)（公开）。

0.5.0 合并前浏览器验收：两道新关卡均全币通关，手机触摸与键盘操作、暂停画面冻结、离线冷重载和 24/24 本地存档保留通过。发布状态以对应 Actions 与公网修订为准。
