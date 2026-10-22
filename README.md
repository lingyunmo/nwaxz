# 奶蛙爱洗澡（nwaxz）

面向手机浏览器的 H5 游戏。普通模式挖水解谜；极限恐怖模式在第一人称浴场里躲避奶蛙，寻找工具逃入下水道。

## 当前功能

- 最近核对发布版本为 0.10.0，普通模式十二关、恐怖洗澡模式六关。0.11.0 候选新增独立第一人称逃生篇；发布 SHA 与公网验证见 [发布验证记录](docs/VERIFICATION.md)。
- 极限恐怖“下水道逃生”：七个区域、钥匙与电源目标链、巡逻/听声/追逐 AI、柜内藏身、三次机会、体力与手电、石子诱敌、纸条和逃生纪录。使用独立本地会话及备份，不覆盖原洗澡存档。[完整玩法](docs/ESCAPE_GAME.md)、[绘制素材与提示](docs/ART_ESCAPE.md)、[恐怖配乐](docs/AUDIO_ESCAPE.md)。
- 基础清水源包含 208 滴的粒子水流求解器，采用固定 120 Hz 步进和空间分桶；挖掘网格单元为 CELL8，石块不可挖。
- 第二章加入可交互风扇和限量喷水阀：打开风扇可改变局部水流，阀门按固定流速消耗有限水量。
- 清污分流：污水池生成 64 滴紫色污水；水滴接触会传播污染，污水不能收集泡泡币或计入清水进度。污水流入浴缸会失败并可重试，失败局不保存成绩。
- 水草阻挡清水、吸收最多 12 滴污水后枯萎；先开污水阀（12 滴、spread 0），再开清水阀（208 滴），可用屏幕按钮或 `B`/`V`。海绵容量 160 滴，点击或按 `E` 将库存放入队列，以每秒 80 滴向下挤出并保留水的种类；释放后 1 秒内不会被原海绵立即吸回。水量守恒统计包含植物吸收、海绵库存和待释放队列。
- 第四章“暖暖水工坊”组合阀门与风扇、双海绵接力；工坊场景根据关卡配置用于背景、土层贴图和侧边衬景。
- 每关接到 100 滴水即可获胜，可额外收集 3 枚泡泡币。
- 成绩包含分数和用时；计时从首次有效挖土或操作机关开始，暂停及后台不计时。最高分与最快用时独立合并；旧版 v1 存档可继续读取，旧纪录不会补造分数。
- 浏览器 IndexedDB 本地存档，支持导入/导出；通过 BroadcastChannel 合并存档。
- 设置包含音乐、音效、震动、简化动作和画质选项。0.8.3 已将背景音乐替换为原创 FL Studio 配乐《奶蛙泡泡日》，约 42 秒循环；同源录音加入离线缓存，普通音效由 Web Audio 合成，恐怖模式使用独立原创氛围音与合成怪笑录音。音乐默认关闭，可在设置中试听；配乐记录见 [AUDIO.md](docs/AUDIO.md)。
- PWA 静态资源缓存和提示式更新；构建会检查必需离线资源，离线能力以实际浏览器测试为准。
- 透明角色图集 `public/assets/character/milk-frog-atlas.webp`，包含 idle、breath、blink、look、tap、laugh、celebrate 动作。
- 12 种角色姿态（原有 8 种及新增 4 种），姿态间平滑混合并连续呼吸摆动。

0.10.0 已发布第二章“地下回声”，恐怖洗澡模式共六关，按章解锁并保留旧纪录。既有恐怖美术见 [ART_HORROR.md](docs/ART_HORROR.md)。0.9.1 的 iPhone 声音兼容代码保留，真实 iPhone Safari/微信听感仍待真机复核。0.11.0 新增完整逃生目标链，属于另一种独立玩法；准确验收与发布状态见 [验证记录](docs/VERIFICATION.md)。云端同步尚未实现。

线上游戏：[立即游玩](https://nwaxz.bzlom.cn)。版本与 QA 状态见 [DEVELOPMENT_STATE.md](docs/DEVELOPMENT_STATE.md)，玩法说明见 [GAME_DESIGN.md](docs/GAME_DESIGN.md)，已核对的发布证据见 [验证记录](docs/VERIFICATION.md)。绘制资源见 [ART_V2.md](docs/ART_V2.md)、[ART_PROPS.md](docs/ART_PROPS.md)、[ART_WORKSHOP.md](docs/ART_WORKSHOP.md) 和 [ART_BATHROOM.md](docs/ART_BATHROOM.md)。

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

原生测试覆盖关卡路线与全金币、质量守恒、长帧处理、石块不可变和存档收敛。运行 `pnpm check` 可在本地复现测试及构建检查；最近一次发布的具体结果见[验证记录](docs/VERIFICATION.md)。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [开发状态与后续计划](docs/DEVELOPMENT_STATE.md)
- [游戏设计](docs/GAME_DESIGN.md)
- [部署说明](docs/DEPLOYMENT.md)
- [贡献指南](CONTRIBUTING.md)
- [安全问题报告](SECURITY.md)

源码仓库：[lingyunmo/nwaxz](https://github.com/lingyunmo/nwaxz)（公开）。

0.5.0 发布前浏览器验收：两道新关卡均全币通关，手机触摸与键盘操作、暂停画面冻结、离线冷重载和 24/24 本地存档保留通过。线上发布证据见 [验证记录](docs/VERIFICATION.md)。
