# 部署说明

本文记录 nwaxz 发布流程。首个线上版本已通过所列 CI 与生产检查；单次成功不代表后续发布自动成功。不要在文档中记录生产地址或密钥。

## CI 流程

`.github/workflows/release.yml` 包含 Verify、Build image、Deploy nwaxz 三个作业。PR 运行 Verify；推送 `main` 运行 Verify 并构建按提交 SHA 标记的 GHCR 镜像。部署作业只有在仓库变量 `DEPLOY_ENABLED` 为 `true` 时才启用。

镜像构建后在 `network none` 的容器中执行冒烟检查，再推送到 `ghcr.io/lingyunmo/nwaxz`。部署使用镜像 digest 锁定具体构建。GHCR 使用 GitHub Actions 提供的 `GITHUB_TOKEN`，仅在相应作业执行期间使用，不应另存为长期仓库密钥。

## 仓库配置

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DEPLOY_ENABLED` | Repository variable | 设为 `true` 才启用自动部署 |
| `DEPLOY_HOST` | Repository secret | nwaxz 专用 SSH 主机名或地址，作为 secret 管理 |
| `DEPLOY_HOST_KEY` | Repository variable | SSH `known_hosts` 格式的主机公钥条目 |
| `DEPLOY_SSH_KEY` | Repository secret | `nwaxz-deploy` 限权账户使用的专用私钥 |

私钥对应的 OS 账户应限制为 nwaxz 专用部署命令，并使用专用命令密钥。不要将现有 root SSH 私钥复制到 GitHub，也不要在仓库、日志或文档中放置私钥、访问令牌或实际服务器地址。部署入口临时接收 GitHub 提供的 GHCR token，拉取完成后清理临时 Docker 凭据。

## 服务器范围

部署脚本固定操作 `/root/minecraft/nwaxz`，其 Compose 项目中的应用服务为 `nwaxz-app`。服务接入已存在的外部 Docker 网络 `common-net`，容器监听内部端口 3000，不发布宿主机端口。

部署使用不可变 GHCR digest。候选镜像先在 `network none` 下运行冒烟检查；通过后仅更新 `nwaxz-app` 并检查健康状态。失败时尝试恢复之前的 nwaxz 镜像。不要执行 `docker compose down`、`docker system prune`，不要更改共享网络或其他容器/服务，不运行破坏性数据库迁移。

外围配置授权也仅限新增 `nwaxz` 反向代理主机及 `nwaxz.bzlom.cn` DNS 记录。不得编辑 `lom` 主机、其 DNS 或其他生产服务。已配置的主机将该域名转发至 `http://nwaxz-app:3000`，使用现有 `Cloudflare_bzlom_cn` 证书并启用 Force SSL 与 HTTP/2；该域名的 Cloudflare A 记录为 Proxied。无需开放宿主机应用端口。

## 安全引导与验证

首次配置应通过已批准的管理通道创建或确认专用 `nwaxz-deploy` OS 账户、命令限制及专用密钥；将对应私钥作为 `DEPLOY_SSH_KEY` secret 配置，将部署主机公钥条目放入 `DEPLOY_HOST_KEY`。使用无持久化权限的 GHCR workflow token 拉取镜像。不要复用旧 root 密钥。

首发记录和修复版本验证是两组独立证据：首发运行见 [run 38606468423](https://github.com/lingyunmo/nwaxz/actions/runs/38606468423)，当时健康接口报告修订 `1180b4fa9b5710d10169147110fc87598688c224`。离线缓存修复通过 PR #4 squash 合并，修复提交为 `282aa6ddb179cc4a1271981cdea16a32bd7a3714`；对应 [main workflow run 38612644262](https://github.com/lingyunmo/nwaxz/actions/runs/38612644262) 的 Verify、Build image、Deploy nwaxz 均成功，公网 smoke 精确核对该 SHA 成功。详细验证结果见[发布验证记录](VERIFICATION.md)。这些证据针对所列修复版本；其他提交均须根据各自工作流和线上检查判断。

源码仓库现为公开，main 分支保护已启用：必须通过 PR，Verify 成功且分支最新；管理员同样受限，要求线性历史并禁止强制推送和删除。单人仓库所需审阅人数为 0。规则由 GitHub 强制执行。

## 0.24 游客好友存储

本批新增 nwaxz 独立命名卷 profile-data，挂载 /app/data，容器内 UID/GID 10001。NWAXZ_PROFILE_DB 指向 guest-social-v1.sqlite；生产缺少该变量会拒绝启动，避免身份静默落入内存。CI 与部署预检使用单独的临时可写 /app/data，不访问生产卷。

服务器上的 compose.prod.yml 和 ops/deploy.sh 不随镜像自动更新；本次发布前已仅在 nwaxz 固定目录核对两文件旧 SHA，保留原件，验证新 Compose 后替换部署支持文件，没有重启容器。之后继续既有受限 Actions 发布入口。新卷仅由下一次 nwaxz compose up 创建，其他服务、数据库和共享网络不变。已在本地验证 SQLite 重开保留身份与好友；具体线上部署状态以 Issue72 发布证据为准。
