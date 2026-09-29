# CullPilot 前端 CI/CD 部署

本仓库的 `.github/workflows/frontend-ci.yml` 在 PR 上运行 `npm ci`、Lint 和生产构建；`main` 分支有新提交或手动运行工作流时，检查通过后将 `dist/` 发布到前端服务器。服务器只需 Nginx 和 `rsync`，不需 Node 或后端运行时。前端仍通过同域 `/api/v1` 请求，由 Nginx 转发到独立的后端；当前后端使用 HTTP:8080，计划升级为 HTTPS。

## 1. 前端服务器准备（root 执行一次）

先按 [Nginx 初始化步骤](nginx-frontend.md)将 `cullpilot.hoshsl.com` 的根目录指向 `/var/www/cullpilot/current`，配置前端 HTTPS 与当前后端代理。然后执行：

```bash
apt update && apt install -y rsync
adduser --disabled-password --gecos '' deploy
install -d -o deploy -g www-data -m 755 /var/www/cullpilot
install -d -o deploy -g www-data -m 755 /var/www/cullpilot/releases
chown deploy:www-data /var/www/cullpilot /var/www/cullpilot/releases
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
```

如果 `deploy` 用户已存在，跳过 `adduser`。用本机生成的**专用部署公钥**填写 `/home/deploy/.ssh/authorized_keys`，随后执行：

```bash
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

确认 `deploy` 能通过 SSH 登录，且能在 `/var/www/cullpilot/releases` 创建目录。部署用户没有 sudo 权限；Nginx 配置和证书仍由 root 管理。

## 2. 本机生成部署密钥

在 Windows PowerShell 执行：

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\cullpilot_ci" -C "cullpilot-github-actions"
Get-Content "$env:USERPROFILE\.ssh\cullpilot_ci.pub"
```

将公钥的完整一行粘贴到服务器的 `/home/deploy/.ssh/authorized_keys`。此密钥专供 CI 使用；私钥不要提交到 Git，也不要发送到聊天或文档。CI 要求非交互登录，生成此专用密钥时不要设置口令。

获取服务器 SSH 主机公钥，防止 CI 接受错误的主机。若本机 DNS 或代理将域名映射到虚拟地址，优先使用云服务商控制台显示的**服务器公网 IP** 作为 `DEPLOY_HOST`；以下 `<服务器公网IP>` 均替换为这个真实 IP。可直接在服务器控制台生成 GitHub 所需的完整 known_hosts 记录：

```bash
# 服务器上
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
awk -v host='<服务器公网IP>' '{print host, $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

第二条输出的完整一行直接填入 `DEPLOY_KNOWN_HOSTS`。它包含主机 IP、`ssh-ed25519` 和公钥内容；不要填写私钥或只有 `SHA256:...` 的指纹。

若要从本机使用 `ssh-keyscan` 再核对，先确认 SSH 端口可达，并且**不要隐藏错误输出**：

```powershell
# 本机 PowerShell，在 AiC_ui 目录中
New-Item -ItemType Directory -Force ..\temp | Out-Null
Test-NetConnection <服务器公网IP> -Port 22
ssh-keyscan -T 10 -t ed25519 <服务器公网IP> | Set-Content -Encoding ascii ..\temp\cullpilot_known_hosts
ssh-keygen -lf ..\temp\cullpilot_known_hosts
```

本机显示的指纹必须与服务器 `ssh-keygen -lf` 的指纹一致。若 `Test-NetConnection` 失败或文件没有生成，检查真实 IP、云安全组、服务器 SSH 服务及端口；不要把空文件填入 Secret。当前工作流使用 SSH 22 端口，其他端口需要同步修改工作流的 SSH/rsync 配置。

## 3. 配置 GitHub

打开本仓库 **Settings → Secrets and variables → Actions → New repository secret**，添加：

| Secret | 内容 |
| --- | --- |
| `DEPLOY_HOST` | 可访问 SSH 的域名或服务器真实公网 IP；需与 known_hosts 第一列完全匹配 |
| `DEPLOY_SSH_KEY` | `cullpilot_ci` 私钥的完整内容，含 BEGIN/END 行 |
| `DEPLOY_KNOWN_HOSTS` | 已核对指纹的 `cullpilot_known_hosts` 完整内容 |

可选：在 **Settings → Environments** 建立 `production`，限制只能从 `main` 部署，并按仓库权限与 GitHub 计划设置审批。工作流已经引用该环境。

## 4. 第一次运行与日常发布

先把工作流提交到 `main`。在 GitHub 的 **Actions → Frontend CI and deploy** 查看检查与部署日志。服务器部署成功后，验证 `https://cullpilot.hoshsl.com/` 和 `https://cullpilot.hoshsl.com/api/v1/health`。后者依赖独立后端，前端部署的自动冒烟检查只检查首页。

以后本地开发完成后，提交并推送到 `main` 即自动发布。PR 只做检查，不接触部署密钥。也可在 Actions 页面通过 **Run workflow** 手动重新发布 `main`；其他分支不会执行部署。单次发布目录由提交 SHA 和工作流运行编号组成；`current` 软链接切换到新版本。若首页检查失败，工作流尝试恢复原链接。

回滚时在服务器查看已有版本和当前目标：

```bash
readlink /var/www/cullpilot/current
ls -1 /var/www/cullpilot/releases
```

确认要恢复的目录名称后，以 root 执行（把 `<旧版本目录名>` 换成实际值）：

```bash
ln -sfn releases/<旧版本目录名> /var/www/cullpilot/current.next
mv -Tf /var/www/cullpilot/current.next /var/www/cullpilot/current
```

暂不自动删除旧版本，以保留回滚能力。定期检查磁盘空间，再人工清理确认不再需要的历史版本。
