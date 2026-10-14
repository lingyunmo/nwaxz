# 部署说明

本文描述 nwaxz 的发布流程和预期配置，不证明 CI、服务器、DNS 或反向代理已经成功配置。不要在文档中记录生产地址或密钥。

## CI 流程

`.github/workflows/release.yml` 包含 Verify、Build image、Deploy nwaxz 三个作业。PR 运行 Verify；推送 `main` 运行 Verify 并构建按提交 SHA 标记的 GHCR 镜像。部署作业只有在仓库变量 `DEPLOY_ENABLED` 为 `true` 时才启用。

镜像构建后在 `network none` 的容器中执行冒烟检查，再推送到 `ghcr.io/lingyunmo/nwaxz`。部署使用镜像 digest 锁定具体构建。GHCR 使用 GitHub Actions 提供的 `GITHUB_TOKEN`，仅在相应作业执行期间使用，不应另存为长期仓库密钥。

## 仓库配置

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `DEPLOY_ENABLED` | Repository variable | 设为 `true` 才启用自动部署 |
| `DEPLOY_HOST` | Repository variable | nwaxz 专用 SSH 主机名或地址，仅在 GitHub 配置中维护 |
| `DEPLOY_HOST_KEY` | Repository variable | SSH `known_hosts` 格式的主机公钥条目 |
| `DEPLOY_SSH_KEY` | Repository secret | `nwaxz-deploy` 限权账户使用的专用私钥 |

私钥对应的 OS 账户应限制为 nwaxz 专用部署命令，并使用专用命令密钥。不要将现有 root SSH 私钥复制到 GitHub，也不要在仓库、日志或文档中放置私钥、访问令牌或实际服务器地址。部署入口临时接收 GitHub 提供的 GHCR token，拉取完成后清理临时 Docker 凭据。

## 服务器范围

部署脚本固定操作 `/root/minecraft/nwaxz`，其 Compose 项目中的应用服务为 `nwaxz-app`。服务接入已存在的外部 Docker 网络 `common-net`，容器监听内部端口 3000，不发布宿主机端口。

部署使用不可变 GHCR digest。候选镜像先在 `network none` 下运行冒烟检查；通过后仅更新 `nwaxz-app` 并检查健康状态。失败时尝试恢复之前的 nwaxz 镜像。不要执行 `docker compose down`、`docker system prune`，不要更改共享网络或其他容器/服务，不运行破坏性数据库迁移。

外围配置授权也仅限新增 `nwaxz` 反向代理主机及 `nwaxz.bzlom.cn` DNS 记录。不得编辑 `lom` 主机、其 DNS 或其他生产服务。代理应将该主机名转发至 Docker 网络中的 nwaxz 服务，不需要开放宿主机应用端口。

## 安全引导与验证

首次配置应通过已批准的管理通道创建或确认专用 `nwaxz-deploy` OS 账户、命令限制及专用密钥；将对应私钥作为 `DEPLOY_SSH_KEY` secret 配置，将部署主机公钥条目放入 `DEPLOY_HOST_KEY`。使用无持久化权限的 GHCR workflow token 拉取镜像。不要复用旧 root 密钥。

配置完成后，先在 GitHub Actions 中确认 Verify 和 Build image 成功；启用 `DEPLOY_ENABLED=true` 后再观察 Deploy nwaxz 作业。部署成功需以作业结果和 `/api/health` 返回目标修订为准。还应单独确认 `nwaxz.bzlom.cn` 的 DNS 解析及对应反向代理主机访问。未实际检查的项目必须标记为待验证，不要声称线上部署已通过。
