# 首发验证记录

线上游戏：[nwaxz.bzlom.cn](https://nwaxz.bzlom.cn)。本文分别记录首发和离线缓存修复版本，避免将首发提交误作当前修复验证的代码版本。以下证据针对修复版本 `282aa6ddb179cc4a1271981cdea16a32bd7a3714`，不代表其他提交自动通过。

## CI 与生产检查

- [GitHub Actions run 38606468423](https://github.com/lingyunmo/nwaxz/actions/runs/38606468423)：Verify、Build image、Deploy nwaxz 全部成功。
- 该首发运行对应的首发修订为 `1180b4fa9b5710d10169147110fc87598688c224`，属于历史记录。
- PR #4 按 main 分支保护规则 squash 合并，修复提交为 `282aa6ddb179cc4a1271981cdea16a32bd7a3714`。
- [修复版本 main workflow run 38612644262](https://github.com/lingyunmo/nwaxz/actions/runs/38612644262)：Verify、Build image、Deploy nwaxz 全部成功；公网 smoke 精确核对该提交 SHA 成功。
- GitHub 提交签名验证结果为 valid。
- 公网 HTTP 请求返回 HTTPS 重定向；HTTPS `/api/health` 对修复版本返回对应 SHA。
- 公网 smoke 检查通过，覆盖页面 HTML、引用资源和 Service Worker。
- `nwaxz-app` 健康运行于预先存在的 `common-net`，无宿主机发布端口；部署后隔离预检容器已清理。
- 首发和修复部署前后均对比预存容器；所有容器的 ID、StartedAt 和 RestartCount 均保持不变。
- 仅新增 `nwaxz.bzlom.cn` 代理主机和对应 Cloudflare A 记录（Proxied）。代理使用已有 `Cloudflare_bzlom_cn` 证书并开启 Force SSL、HTTP/2；没有改动其他 DNS 或代理主机。

## 游戏检查

- 修复版本通过 8 项检查：7 项业务测试和 1 项构建后的离线缓存清单回归检查（本地日期 2026-10-15）。
- Chrome 公网实测三关均成功通关，每关均获得 3/3 泡泡币；刷新后每关的 3/3 本地存档仍保留。
- 390 × 844 移动视口检查通过；透明角色图集在 Canvas 中显示正常。
- 首发离线重载检查发现缓存清单重复导致 Workbox 初始化中断。PR #4 修复重复登记及固定名称素材的缓存修订后，Chrome 公网点击更新缓存 17 项资源；断网 reload 可打开完整游戏、角色及本机 3/3 存档，并可离线挖通第一关，得到 100/100 水与 3/3 泡泡币。
- 云端存档同步和音效尚未实现。

以上修复版本的 CI、精确 SHA smoke、浏览器三关和公网离线复测记录日期为 2026-10-15（本地日期）。此后文档变更合并会产生新的部署版本，应以新版本自己的工作流与验证结果为准；本文不预设未来提交 SHA。

## 仓库策略

源码仓库现为公开。main 分支保护已经启用并由 GitHub 强制执行：必须 PR、Verify 成功且分支最新，管理员也受规则约束，要求线性历史并禁止强制推送和删除。单人维护下所需审阅人数为 0。

部署主机配置 `DEPLOY_HOST` 已作为 Repository secret 保存；私密漏洞报告 API 已启用（`enabled=true`）。
