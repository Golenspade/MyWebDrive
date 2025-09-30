# Nextra v3 快速上手指南

## 🚀 快速开始

### 启动开发服务器
```bash
cd frontend/cruip-landing
npm run dev
```

访问文档：http://localhost:4323/docs

## 📁 目录结构

```
frontend/cruip-landing/
├── pages/
│   └── docs/              # 文档根目录
│       ├── _meta.js       # 导航配置
│       ├── index.mdx      # 文档首页
│       └── txt2mp4/       # 子目录
│           ├── _meta.js   # 子导航配置
│           └── index.mdx  # 子页面
├── theme.config.jsx       # 主题配置
└── next.config.js         # Next.js + Nextra 配置
```

## ✍️ 添加新页面

### 1. 创建 MDX 文件

在 `pages/docs/` 下创建新文件，例如 `getting-started.mdx`：

```mdx
# 快速入门

欢迎使用从txt到mp4工具！

## 安装

首先安装必要的工具...

## 使用

按照以下步骤...
```

### 2. 更新导航配置

编辑 `pages/docs/_meta.js`：

```javascript
export default {
  index: '文档首页',
  'getting-started': '快速入门',  // 新增
  txt2mp4: '从txt到mp4',
};
```

### 3. 创建子目录

创建 `pages/docs/advanced/` 目录：

```bash
mkdir pages/docs/advanced
```

创建 `pages/docs/advanced/_meta.js`：

```javascript
export default {
  index: '高级功能',
  'custom-config': '自定义配置',
  'api-reference': 'API 参考',
};
```

创建对应的 MDX 文件：
- `pages/docs/advanced/index.mdx`
- `pages/docs/advanced/custom-config.mdx`
- `pages/docs/advanced/api-reference.mdx`

## 🎨 MDX 功能

### 基础 Markdown

```mdx
# 标题 1
## 标题 2
### 标题 3

**粗体** *斜体* `代码`

- 列表项 1
- 列表项 2

1. 有序列表 1
2. 有序列表 2

[链接](https://example.com)

![图片](./image.png)
```

### 代码块

````mdx
```javascript
function hello() {
  console.log('Hello World!');
}
```

```bash
npm install
npm run dev
```
````

### 提示框（Callout）

```mdx
import { Callout } from 'nextra/components'

<Callout type="info">
  这是一个信息提示框
</Callout>

<Callout type="warning">
  这是一个警告提示框
</Callout>

<Callout type="error">
  这是一个错误提示框
</Callout>
```

### 标签页（Tabs）

```mdx
import { Tabs } from 'nextra/components'

<Tabs items={['npm', 'yarn', 'pnpm']}>
  <Tabs.Tab>
    ```bash
    npm install
    ```
  </Tabs.Tab>
  <Tabs.Tab>
    ```bash
    yarn add
    ```
  </Tabs.Tab>
  <Tabs.Tab>
    ```bash
    pnpm add
    ```
  </Tabs.Tab>
</Tabs>
```

### 步骤（Steps）

```mdx
import { Steps } from 'nextra/components'

<Steps>
### 步骤 1
 
安装依赖
 
### 步骤 2
 
配置文件
 
### 步骤 3
 
运行项目
</Steps>
```

## ⚙️ 配置

### theme.config.jsx

```javascript
export default {
  logo: <span>你的文档标题</span>,
  
  // GitHub 链接
  project: {
    link: 'https://github.com/your/repo',
  },
  
  // 编辑链接
  docsRepositoryBase: 'https://github.com/your/repo/tree/main/pages',
  
  // SEO 配置
  useNextSeoProps() {
    return {
      titleTemplate: '%s – 你的网站'
    }
  },
  
  // 页脚
  footer: {
    text: <span>
      MIT {new Date().getFullYear()} © Your Company.
    </span>
  },
  
  // 搜索
  search: {
    placeholder: '搜索文档...'
  },
  
  // 目录
  toc: {
    title: '本页目录'
  }
};
```

### _meta.js 高级配置

```javascript
export default {
  index: '首页',
  
  // 带图标
  guide: {
    title: '指南',
    icon: '📖'
  },
  
  // 外部链接
  github: {
    title: 'GitHub',
    href: 'https://github.com/your/repo',
    newWindow: true
  },
  
  // 分隔符
  '---': {
    type: 'separator'
  },
  
  // 隐藏页面
  hidden: {
    display: 'hidden'
  }
};
```

## 📝 最佳实践

### 1. 文件命名
- 使用小写字母和连字符：`getting-started.mdx`
- 避免空格和特殊字符
- 中文页面可以用拼音或英文

### 2. 目录组织
```
pages/docs/
├── index.mdx           # 首页
├── getting-started.mdx # 快速入门
├── guide/              # 指南目录
│   ├── _meta.js
│   ├── index.mdx
│   ├── basics.mdx
│   └── advanced.mdx
└── api/                # API 文档
    ├── _meta.js
    └── reference.mdx
```

### 3. 图片资源
将图片放在 `public/images/docs/` 下：

```mdx
![示例图片](/images/docs/example.png)
```

### 4. 内部链接
```mdx
查看 [快速入门](/docs/getting-started) 了解更多。
```

## 🔍 常见问题

### Q: 如何修改文档路由前缀？
A: 在 `next.config.js` 中配置 `basePath`

### Q: 如何添加自定义组件？
A: 在 MDX 文件中直接 import 和使用 React 组件

### Q: 如何自定义样式？
A: 在 `app/css/style.css` 中添加全局样式，或使用 Tailwind CSS

### Q: 如何部署？
A: 运行 `npm run build` 然后 `npm start`，或部署到 Vercel

## 📚 更多资源

- [Nextra 官方文档](https://nextra.site/)
- [MDX 文档](https://mdxjs.com/)
- [Next.js 文档](https://nextjs.org/docs)

