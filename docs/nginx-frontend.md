# 前端服务器 Nginx 初始化

适用于 Ubuntu 前端服务器，前端域名 `cullpilot.hoshsl.com`，独立后端当前位于 `http://api.cullpilot.hoshsl.com:8080`。以下命令以 root 身份在**前端服务器**执行。完成后，Nginx 从 `/var/www/cullpilot/current` 提供静态页面，并把 `/api/` 转发到后端。浏览器仍只访问前端 HTTPS 域名。

## 1. 安装并检查

先确认域名 A/AAAA 记录指向这台服务器的公网地址，并在云服务器安全组放行 80、443；SSH 端口保持可用。执行：

```bash
apt update
apt install -y nginx snapd ca-certificates curl
systemctl enable --now nginx
nginx -v
getent ahostsv4 cullpilot.hoshsl.com
```

如启用了 UFW，再执行 `ufw allow 80/tcp` 和 `ufw allow 443/tcp`；不要在确认 SSH 放行前启用或重置防火墙。

## 2. 建立首次发布目录

```bash
install -d -m 755 /var/www/cullpilot/releases/initial
printf '<!doctype html><meta charset="utf-8"><title>CullPilot</title><h1>CullPilot 前端准备中</h1>\n' > /var/www/cullpilot/releases/initial/index.html
if [ ! -e /var/www/cullpilot/current ] && [ ! -L /var/www/cullpilot/current ]; then
  ln -s releases/initial /var/www/cullpilot/current
fi
```

如果 `current` 已存在，先用 `readlink /var/www/cullpilot/current` 检查现有目标，不覆盖已有发布。

## 3. 创建站点配置

```bash
cat > /etc/nginx/sites-available/cullpilot.hoshsl.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name cullpilot.hoshsl.com;

    root /var/www/cullpilot/current;
    index index.html;
    client_max_body_size 110m;

    location ^~ /api/ {
        default_type application/json;
        add_header Cache-Control "no-store" always;
        return 503 '{"error":{"code":"BACKEND_NOT_CONFIGURED","message":"Backend is not configured"}}';
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -s /etc/nginx/sites-available/cullpilot.hoshsl.com /etc/nginx/sites-enabled/cullpilot.hoshsl.com
nginx -t
systemctl reload nginx
```

如果站点启用软链接已存在，不重复执行 `ln -s`。用以下命令验证 HTTP；看到“前端准备中”即表示 Nginx 路径正确：

```bash
curl -i -H 'Host: cullpilot.hoshsl.com' http://127.0.0.1/
curl -i http://cullpilot.hoshsl.com/api/v1/health
```

第二条暂时应返回 503，表示 API 尚未接入，而不是页面 HTML。

## 4. 启用 HTTPS

若 `command -v certbot` 没有结果，安装 Certbot：

```bash
snap install --classic certbot
ln -s /snap/bin/certbot /usr/local/bin/certbot
```

申请证书并让 HTTP 跳转到 HTTPS：

```bash
certbot --nginx -d cullpilot.hoshsl.com --redirect
certbot renew --dry-run
curl -I https://cullpilot.hoshsl.com/
nginx -t
```

如申请失败，先检查 DNS、公网 80 端口与云安全组。Certbot 会修改站点的 TLS 部分；之后改 `/api/` 时保留它生成的证书配置。

## 5. 接入当前 HTTP:8080 后端

先从前端服务器测试后端地址：

```bash
curl -i --connect-timeout 10 --max-time 20 http://api.cullpilot.hoshsl.com:8080/api/v1/health
```

确认返回后，备份并编辑 `/etc/nginx/sites-available/cullpilot.hoshsl.com`。只在服务前端的 **443 HTTPS server 块**中，将临时的 `location ^~ /api/` 整段替换为：

```nginx
location ^~ /api/ {
    proxy_pass http://api.cullpilot.hoshsl.com:8080;

    proxy_set_header Host $proxy_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_connect_timeout 10s;
    proxy_read_timeout 180s;
    proxy_send_timeout 180s;
}
```

`proxy_pass` 末尾不要加 `/`，以保留原始 `/api/v1/...` 路径。修改前先备份站点文件。检查 `nginx -t` 输出没有 `conflicting server name` 警告，再重载：

```bash
nginx -t && systemctl reload nginx
curl -i https://cullpilot.hoshsl.com/api/v1/health
```

两条健康检查应返回相同类型的后端响应。若前端域名下返回 502，检查前端服务器到 `api.cullpilot.hoshsl.com:8080` 的连接、后端防火墙以及 Nginx 错误日志。此后浏览器和前端都继续只访问 `cullpilot.hoshsl.com`，无需设置跨域直连。

当前 Nginx 到后端的 HTTP 链路未加密。如果两台服务器有私有网络，优先将 `proxy_pass` 指向后端内网 IP:8080，并限制该端口只接受前端服务器连接；若经过公网，应尽快为后端启用 HTTPS，并在此之前至少限制后端 8080 的来源 IP。升级后将 `proxy_pass` 改为 `https://api.cullpilot.hoshsl.com`，增加 `proxy_ssl_server_name on;`、`proxy_ssl_verify on;` 和 `proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;`，再测试健康接口。
