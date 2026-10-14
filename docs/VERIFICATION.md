# 发布与验证记录

线上游戏：[nwaxz.bzlom.cn](https://nwaxz.bzlom.cn)。记录区分已发布版本与开发中的代码；每次发布应以其对应工作流、提交 SHA 和实际浏览器验收为准。

## 已发布 0.3.0

- 线上提交：`13f2c2870e8832e30b860fa14d04dbbad0b08ad9`。
- [GitHub Actions run 38641714810](https://github.com/lingyunmo/nwaxz/actions/runs/38641714810) 的 Verify、Build image、Deploy nwaxz 全部成功；公网 smoke 精确核对该 SHA。
- Chrome 更新后确认第二章选关可用，旧存档的 9 枚泡泡币均保留。
- 相对 0.2.0 发布后的服务器只读基线，21 个其他容器的 ID、StartedAt 和 RestartCount 均相同。

## 历史发布

- 0.2.0：提交 `6dbd28b813fb601a15addaab10c44e6436311021`；[run 38639392080](https://github.com/lingyunmo/nwaxz/actions/runs/38639392080) 的 Verify、Build image、Deploy nwaxz 成功，公网 smoke 精确核对提交 SHA。
- 0.1.0 首发：[run 38606468423](https://github.com/lingyunmo/nwaxz/actions/runs/38606468423)，健康接口修订为 `1180b4fa9b5710d10169147110fc87598688c224`。
- 离线缓存修复：PR #4 合并 SHA `282aa6ddb179cc4a1271981cdea16a32bd7a3714`；[run 38612644262](https://github.com/lingyunmo/nwaxz/actions/runs/38612644262) 全部发布作业成功，公网 smoke 精确核对该 SHA。Chrome 离线实测更新后缓存资源，断网可打开游戏和本机存档并通关第一关。

## 开发版 0.4.0

- `pnpm check` 通过 25 项业务测试和 1 项 PWA 构建检查。
- 六关模拟路线均能通关并收集全部 3 枚泡泡币。
- Chrome 实际验证错误污水路线触发失败，重试后水量和地形重置，选关记录仍未通关。
- 390 × 844 手机真实触摸正确路线获 100 滴清水和 3/3 泡泡币，3374 分、00:12；未出现应用控制台错误。这是测试操作结果，不作为玩家时长基准。
- 离线冷重载后保留第六关最高分、最快时间与全关 18/18 泡泡币，可离线进入第三章并暂停。随后已恢复网络、视口，触摸模拟已关闭。
- 本段记录发布前验收，仍须核对 main 工作流与公网精确 SHA。
- 游戏前后端版本读取 `package.json`；增加关卡不改变 v1 存档格式。

## 仓库策略与发布范围

源码仓库公开。main 分支保护要求 PR、Verify 成功且分支最新，管理员也受约束；要求线性历史，禁止强制推送和删除，所需审阅人数为 0。`DEPLOY_HOST` 作为 Repository secret 保存；私密漏洞报告 API 已启用。

生产操作限于 nwaxz。服务器检查只读；发布比对表明 0.3.0 相对 0.2.0 发布后的基线未改变其他 21 个容器的 ID、StartedAt 或 RestartCount。文档不记录真实服务器地址。
