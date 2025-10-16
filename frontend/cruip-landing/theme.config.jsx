export default {
  logo: <span>从txt到mp4 文档</span>,
  project: {
    link: 'https://github.com/Golenspade/MyWebDrive',
  },
  // v4: 文档已迁移到 content/
  docsRepositoryBase: 'https://github.com/Golenspade/MyWebDrive/tree/main/frontend/cruip-landing/content',
  editLink: {
    text: '在 GitHub 上编辑此页',
  },
  search: {
    placeholder: '搜索文档…',
  },
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
