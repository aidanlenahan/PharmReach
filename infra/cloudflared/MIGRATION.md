# Public domains

The existing tunnel serves `pharmreach.tech` (app) and `otp.pharmreach.tech` (OTP).

`hackru.alenahan.net` has a proxied CNAME to `02ebf828-e43e-4503-8eb8-7ccb01d87611.cfargotunnel.com`. Its ingress points to the app server, which returns HTTP 301 to `https://pharmreach.tech`, preserving paths and query strings. DNS routes the request; Python performs the browser redirect. The old OTP hostname is retired.

After changing Python or ingress, apply from the repository root:

```bash
sudo systemctl restart hackru
sudo install -m 644 infra/cloudflared/config.yml /etc/cloudflared/config.yml
sudo systemctl restart cloudflared
```

The previous standalone `apply-config.sh` helper has been removed. First-time service setup still uses `infra/systemd/install.sh`.
