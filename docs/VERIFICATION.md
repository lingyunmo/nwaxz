# 发布与验证记录

线上游戏：[nwaxz.bzlom.cn](https://nwaxz.bzlom.cn)。记录区分已发布版本与开发中的代码；每次发布应以其对应工作流、提交 SHA 和实际浏览器验收为准。

## 最近核对的线上发布：0.4.0

- 发布提交：`3dbd632c4c1a7073d707fd593edc70cca57f2298`。
- [GitHub Actions run 38643628629](https://github.com/lingyunmo/nwaxz/actions/runs/38643628629) 的 Verify、Build image、Deploy nwaxz 全部成功；公网 smoke 精确核对该 SHA。
- 该发布包含六关及 `clean-water-only` 污水机制。
- Chrome 更新后确认公网第三章第六关入口、保留旧 9 枚泡泡币及正确解锁限制；0.5.0 的本地结果与线上验证分别记录。

## 历史发布

- 0.2.0：提交 `6dbd28b813fb601a15addaab10c44e6436311021`；[run 38639392080](https://github.com/lingyunmo/nwaxz/actions/runs/38639392080) 的 Verify、Build image、Deploy nwaxz 成功，公网 smoke 精确核对提交 SHA。
- 0.1.0 首发：[run 38606468423](https://github.com/lingyunmo/nwaxz/actions/runs/38606468423)，健康接口修订为 `1180b4fa9b5710d10169147110fc87598688c224`。
- 离线缓存修复：PR #4 合并 SHA `282aa6ddb179cc4a1271981cdea16a32bd7a3714`；[run 38612644262](https://github.com/lingyunmo/nwaxz/actions/runs/38612644262) 全部发布作业成功，公网 smoke 精确核对该 SHA。Chrome 离线实测更新后缓存资源，断网可打开游戏和本机存档并通关第一关。

## 开发快照 0.5.0

- 当前分支 `codex/plant-sponge-levels` 的 `pnpm check` 通过 31 项业务测试和 1 项 PWA 构建检查。
- 八关模拟路线均以半径 25 挖掘、通关并收集全部 3 枚泡泡币。
- `garden-gate` 覆盖水草阻挡清水、有限吸收污水后枯萎；`sponge-transfer` 覆盖海绵容量、库存/队列守恒、释放水种类及防立即重吸。物理模拟不是浏览器实玩证据。
- 两个新增关卡已完成本地浏览器全币通关、暂停、触控与离线验收，详细证据见下文；发布需单独核对 main 工作流和公网精确 SHA。
- 新关卡沿用 v1 存档格式，原六关和存档兼容性保持在实现范围内；上线状态以未来合并后的 main Actions 与公网精确 SHA 另行核对。

## 历史发布记录

- 0.3.0：提交 `13f2c2870e8832e30b860fa14d04dbbad0b08ad9`；[run 38641714810](https://github.com/lingyunmo/nwaxz/actions/runs/38641714810) 全部发布作业成功，公网 smoke 精确核对 SHA；Chrome 更新后确认第二章选关可用且保留旧 9 枚泡泡币。与当时 0.2.0 后基线相比，21 个其他容器 ID、StartedAt、RestartCount 未变。

## 仓库策略与发布范围

源码仓库公开。main 分支保护要求 PR、Verify 成功且分支最新，管理员也受约束；要求线性历史，禁止强制推送和删除，所需审阅人数为 0。`DEPLOY_HOST` 作为 Repository secret 保存；私密漏洞报告 API 已启用。

生产操作限于 nwaxz。服务器检查只读；发布比对表明 0.3.0 相对 0.2.0 发布后的基线未改变其他 21 个容器的 ID、StartedAt 或 RestartCount。文档不记录真实服务器地址。

## 0.5.0 合并前浏览器验收补充

Chrome 已实际通关两道新关卡，各获 3/3 泡泡币；验证 390 × 844 真实触摸划土、B 键污水阀、触摸清水阀、E 键及触摸挤水。海绵暂停期间两次画布像素摘要一致。精确候选构建断网冷重载保留两关最高分、最快时间和 24/24 泡泡币，可离线进入水草关并加载道具；无应用控制台错误。测试结束已恢复网络、触摸模拟和视口。

本地水草关 2500 分、04:38；海绵关 2500 分、08:26。测试操作包含较长阅读与等待，不作为玩家时长或设备性能基准。照片与 UI 核对在本地，线上发布另以对应工作流和精确 SHA 为准。
