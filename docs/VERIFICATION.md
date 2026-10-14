# 首发验证记录

首个生产版本已部署至[线上游戏](https://nwaxz.bzlom.cn)。以下记录仅覆盖已执行的检查，不代表后续版本自动通过。

## CI 与生产检查

- [GitHub Actions run 38606468423](https://github.com/lingyunmo/nwaxz/actions/runs/38606468423)：Verify、Build image、Deploy nwaxz 全部成功。
- GitHub 提交签名验证结果为 valid。
- 公网 HTTP 请求返回 HTTPS 重定向；HTTPS `/api/health` 返回修订 `1180b4fa9b5710d10169147110fc87598688c224`。
- 公网 smoke 检查通过，覆盖页面 HTML、引用资源和 Service Worker。
- `nwaxz-app` 健康运行于预先存在的 `common-net`，无宿主机发布端口；部署后隔离预检容器已清理。
- 部署前后对比显示，所有预存容器的 ID、启动时间和重启次数保持不变。
- 仅新增 `nwaxz.bzlom.cn` 代理主机和对应 Cloudflare A 记录（Proxied）。代理使用已有 `Cloudflare_bzlom_cn` 证书并开启 Force SSL、HTTP/2；没有改动其他 DNS 或代理主机。

## 游戏检查

- 7 项 Node 原生测试和 1 项构建后的离线缓存清单回归检查通过。
- Chrome 公网实测三关均成功通关，每关均获得 3/3 泡泡币；刷新后每关的 3/3 本地存档仍保留。
- 390 × 844 移动视口检查通过；透明角色图集在 Canvas 中显示正常。
- 首发离线重载检查发现缓存清单重复导致 Workbox 初始化中断。已修复重复登记及固定名称素材的缓存修订，本地生产构建实际缓存 17 项资源，Chrome 断网重载后页面、角色及本机存档均可用。更新部署后的公网离线复测待完成。
- 云端存档同步和音效尚未实现。

## 仓库策略

源码仓库现为公开。main 分支保护已经启用并由 GitHub 强制执行：必须 PR、Verify 成功且分支最新，管理员也受规则约束，要求线性历史并禁止强制推送和删除。单人维护下所需审阅人数为 0。
