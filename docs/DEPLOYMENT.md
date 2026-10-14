# 部署说明

本文记录 nwaxz 发布流程。首个线上版本已通过所列 CI 与生产检查；单次成功不代表后续发布自动成功。不要在文档中记录生产地址或密钥。

## CI 流程

`.github/workflows/release.yml` 包含 Verify、Build image、Deploy nwaxz 三个作业。PR 运行 Verify；推送 `main` 运行 Verify 并构建按提交 SHA 标记的 GHCR 镜像。部署作业只有在仓库变量 `DEPLOY_ENABLED` 为 `true` 时才启用。

镜像构建后在 `network none` 的容器中执行冒烟检查，再推送到 `ghcr.io/lingyunmo/nwaxz`。部署使用镜像 digest 锁定具体构建。GHCR 使用 GitHub Actions 提供的 `GITHUB_TOKEN`，仅在相应作业执行期间使用，不应另存为长期仓库密钥。

## 仓库配置

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DEPLOY_ENABLED` | Repository variable | 设为 `true` 才启用自动部署 |
| `DEPLOY_HOST` | Repository secret | nwaxz 专用 SSH 主机名或地址，公开仓库中由 secret 遮蔽作业日志 |
| `DEPLOY_HOST_KEY` | Repository variable | SSH `known_hosts` 格式的主机公钥条目 |
| `DEPLOY_SSH_KEY` | Repository secret | `nwaxz-deploy` 限权账户使用的专用私钥 |

私钥对应的 OS 账户应限制为 nwaxz 专用部署命令，并使用专用命令密钥。不要将现有 root SSH 私钥复制到 GitHub，也不要在仓库、日志或文档中放置私钥、访问令牌或实际服务器地址。部署入口临时接收 GitHub 提供的 GHCR token，拉取完成后清理临时 Docker 凭据。

## 服务器范围

部署脚本固定操作 `/root/minecraft/nwaxz`，其 Compose 项目中的应用服务为 `nwaxz-app`。服务接入已存在的外部 Docker 网络 `common-net`，容器监听内部端口 3000，不发布宿主机端口。

部署使用不可变 GHCR digest。候选镜像先在 `network none` 下运行冒烟检查；通过后仅更新 `nwaxz-app` 并检查健康状态。失败时尝试恢复之前的 nwaxz 镜像。不要执行 `docker compose down`、`docker system prune`，不要更改共享网络或其他容器/服务，不运行破坏性数据库迁移。

外围配置授权也仅限新增 `nwaxz` 反向代理主机及 `nwaxz.bzlom.cn` DNS 记录。不得编辑 `lom` 主机、其 DNS 或其他生产服务。已配置的主机将该域名转发至 `http://nwaxz-app:3000`，使用现有 `Cloudflare_bzlom_cn` 证书并启用 Force SSL 与 HTTP/2；该域名的 Cloudflare A 记录为 Proxied。无需开放宿主机应用端口。

## 安全引导与验证

首次配置应通过已批准的管理通道创建或确认专用 `nwaxz-deploy` OS 账户、命令限制及专用密钥；将对应私钥作为 `DEPLOY_SSH_KEY` secret 配置，将部署主机公钥条目放入 `DEPLOY_HOST_KEY`。使用无持久化权限的 GHCR workflow token 拉取镜像。不要复用旧 root 密钥。

首个发布已在 GitHub Actions 的 [run 38606468423](https://github.com/lingyunmo/nwaxz/actions/runs/38606468423) 完成 Verify、Build image、Deploy nwaxz。生产站点 [nwaxz.bzlom.cn](https://nwaxz.bzlom.cn) 返回 HTTP 到 HTTPS 重定向，`/api/health` 报告修订 `1180b4fa9b5710d10169147110fc87598688c224`，线上 smoke 检查覆盖 HTML、资源和 Service Worker。详细证据及客户端验证边界见[首发验证记录](VERIFICATION.md)。这些结果只证明该次首发；之后每次发布都应重新检查对应工作流、目标修订和公开站点。

源码仓库现为公开，main 分支保护已启用：必须通过 PR，Verify 成功且分支最新；管理员同样受限，要求线性历史并禁止强制推送和删除。单人仓库所需审阅人数为 0。规则由 GitHub 强制执行。
