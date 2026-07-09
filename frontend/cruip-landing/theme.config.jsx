export default {
  logo: (
    <span className="font-nothing-head text-lg font-semibold text-nothing-primary">
      从txt到mp4 文档
    </span>
  ),
  project: {
    link: 'https://github.com/Golenspade/MyWebDrive',
  },
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
    text: (
      <span className="text-sm text-nothing-secondary">
        MIT {new Date().getFullYear()} ©{' '}
        <a
          href="https://mygoavemujica.top"
          target="_blank"
          rel="noreferrer"
          className="text-nothing-primary hover:opacity-80 transition-opacity duration-200 ease-in-out"
        >
          MyGO Studio
        </a>.
      </span>
    ),
  },
  // Nextra v4 app router: keep docs monochrome and dot-field via global CSS overrides
  darkMode: false,
};
