# Contributing to MyWebDrive

Thank you for your interest in contributing to MyWebDrive! This document provides guidelines and instructions for contributing.

## 最新状态（2026-01-13）
- 生产域名：`https://mygoavemujica.top`（HTTP/2 + HTTPS 正常）
- 部署方式：ECS Docker Compose（镜像离线导入）
- 服务健康：网关 `/api/v1/health` 返回 `200`，登录/注册可用
- 数据库：`auth`/`user`/`metadata` schema 已初始化；邮件服务未配置

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/Golenspade/MyWebDrive/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with the `enhancement` label
3. Describe the feature and its use case

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Follow our coding conventions (see below)
4. Write tests for new functionality
5. Run the quality check: `make quality-check`
6. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): add new feature`
   - `fix(scope): fix bug`
   - `docs(scope): update documentation`
   - `chore(scope): maintenance task`
7. Push and create a Pull Request

## Development Setup

```bash
# Prerequisites: Node.js 20+, pnpm
pnpm -w install

# Start database
docker compose -f infrastructure/docker-compose.db.yml up -d

# Initialize databases
for svc in auth user metadata storage sharing; do
  pnpm --filter ./services/$svc db:push
done

# Start backend services
./manage-services.sh start-backend

# Start frontend
./manage-services.sh start-frontend
```

## Coding Conventions

- **Language**: TypeScript (strict mode)
- **Formatting**: 2-space indent, single quotes, no semicolons
- **Filenames**: kebab-case
- **Exports**: Prefer named exports
- **Environment variables**: UPPER_SNAKE_CASE

## Testing

- Place tests in `src/__tests__/*.test.ts`
- Run tests: `pnpm test`
- Run quality gate before PR: `make quality-check`

## Questions?

Feel free to open an issue or start a discussion.

