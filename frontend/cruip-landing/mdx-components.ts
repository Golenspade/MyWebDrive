// Re-export Docs theme MDX components (provides wrapper & config)
import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs'

// Get the default MDX components from the theme
const themeComponents = getThemeComponents()

// Must export a function named `useMDXComponents`
export function useMDXComponents(components: any) {
  return {
    ...themeComponents,
    ...components,
  }
}

