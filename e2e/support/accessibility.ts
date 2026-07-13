import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

export async function expectNoSeriousAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const blocking = result.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
  if (blocking.length > 0) {
    const summary = blocking
      .map(({ id, help, nodes }) => {
        const targets = nodes.flatMap(({ target }) => target).join(', ')
        return `${id}: ${help} (${targets})`
      })
      .join('\n')

    throw new Error(`Critical or serious accessibility violations:\n${summary}`)
  }
}
