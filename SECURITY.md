# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email the security team at 154531132+Golenspade@users.noreply.github.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

### Disclosure Policy

- We follow responsible disclosure practices
- We will credit reporters (unless anonymity is requested)
- We will notify you when the vulnerability is fixed

## Security Best Practices

When deploying MyWebDrive:

1. **Environment Variables**
   - Never commit secrets to version control
   - Use strong, unique `JWT_SECRET` values
   - Rotate secrets regularly

2. **Database**
   - Use strong passwords for PostgreSQL
   - Enable SSL for database connections in production
   - Regular backups

3. **Network**
   - Use HTTPS in production
   - Configure proper CORS origins
   - Use a reverse proxy (nginx, Caddy)

4. **Updates**
   - Keep dependencies updated
   - Monitor security advisories

## Known Security Considerations

- Default development configuration uses permissive CORS (`*`)
- Kubernetes example configs contain placeholder secrets
- Always review and customize before production deployment

