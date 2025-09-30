# Nextra v3 回退记录

## 📅 迁移日期
2025-09-30

## 🎯 迁移原因
- Nextra v4.5.1 是 2025-09-27 刚发布的最新版本
- 官方文档主要还是 v3 的内容，v4 文档不完善
- 为了稳定性和更好的文档支持，回退到 v3.3.1

## 📦 版本变更

### 之前（v4）
```json
"nextra": "^4.5.1",
"nextra-theme-docs": "^4.5.1"
```

### 之后（v3）
```json
"nextra": "^3.3.1",
"nextra-theme-docs": "^3.3.1"
```

## 🔧 主要变更

### 1. 配置文件 (next.config.js)

**v4 配置：**
```javascript
const { default: nextra } = require('nextra');
const withNextra = nextra({
  contentDirBasePath: '/docs',
});
// 需要 Turbopack alias 配置
```

**v3 配置：**
```javascript
const withNextra = require('nextra').default({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
  defaultShowCopyCode: true,
});
```

### 2. 目录结构

**v4 结构：**
```
app/
  docs/
    [[...mdxPath]]/
      page.tsx
content/
  _meta.js
  index.mdx
  txt2mp4/
mdx-components.ts
```

**v3 结构：**
```
pages/
  docs/
    _meta.js
    index.mdx
    txt2mp4/
      _meta.js
      index.mdx
```

### 3. _meta.js 格式

**v4 格式：**
```javascript
export default {
  '*': { type: 'page' },
  txt2mp4: { title: '从txt到mp4' },
};
```

**v3 格式：**
```javascript
export default {
  index: '文档首页',
  txt2mp4: '从txt到mp4',
};
```

### 4. theme.config.jsx

**v3 配置更丰富：**
```javascript
export default {
  logo: <span>从txt到mp4 文档</span>,
  project: {
    link: 'https://github.com/Golenspade/MyWebDrive',
  },
  docsRepositoryBase: 'https://github.com/Golenspade/MyWebDrive/tree/main/frontend/cruip-landing/pages',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – 从txt到mp4'
    }
  },
  footer: {
    text: <span>
      MIT {new Date().getFullYear()} © <a href="https://mygoavemujica.top" target="_blank">MyGO Studio</a>.
    </span>
  }
};
```

## 📝 迁移步骤

1. ✅ 修改 package.json 中的版本号
2. ✅ 更新 next.config.js 配置
3. ✅ 创建 pages/docs 目录
4. ✅ 迁移 content 内容到 pages/docs
5. ✅ 调整 _meta.js 格式
6. ✅ 删除 v4 特有文件（app/docs, mdx-components.ts, content）
7. ✅ 更新 theme.config.jsx
8. ✅ 重新安装依赖（使用 --legacy-peer-deps）
9. ✅ 测试开发服务器

## 🚀 使用方法

### 启动开发服务器
```bash
cd frontend/cruip-landing
npm run dev
```

访问：http://localhost:4323/docs

### 添加新文档页面

在 `pages/docs/` 下创建 `.mdx` 文件：

```mdx
# 页面标题

这是内容...
```

在对应目录的 `_meta.js` 中添加导航：

```javascript
export default {
  'page-name': '页面显示名称',
};
```

## 📚 参考资源

- [Nextra v3 官方文档](https://nextra.site/)
- [Nextra v3 GitHub](https://github.com/shuding/nextra/tree/v3)
- [Next.js 文档](https://nextjs.org/docs)

## ⚠️ 注意事项

1. 使用 `npm install --legacy-peer-deps` 安装依赖（因为有 @react-three/fiber 的 peer dependency 冲突）
2. v3 使用 Pages Router，不是 App Router
3. 文档路由自动基于 `pages/docs/` 目录结构生成
4. 所有 MDX 文件都会自动成为路由

## 🔄 未来升级到 v4

当 Nextra v4 文档完善后，可以参考以下步骤升级：

1. 升级依赖到 v4
2. 将 `pages/docs/` 迁移到 `content/`
3. 创建 `app/docs/[[...mdxPath]]/page.tsx`
4. 调整 next.config.js 配置
5. 创建 mdx-components.ts
6. 更新 _meta.js 格式
7. 删除 pages 目录

## ✅ 验证清单

- [x] 依赖版本正确（v3.3.1）
- [x] 开发服务器正常启动
- [x] 文档页面可访问 (/docs)
- [x] 导航正常显示
- [x] 主题配置生效
- [x] API 代理正常工作

