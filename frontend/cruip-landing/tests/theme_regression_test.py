import base64
import json
import os
import re
import unittest

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get('BASE_URL', 'http://127.0.0.1:4323')


def admin_access_token() -> str:
    payload = base64.urlsafe_b64encode(json.dumps({'role': 'admin'}).encode()).decode().rstrip('=')
    return f'x.{payload}.x'


class ThemeRegressionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.browser.close()
        cls.playwright.stop()

    def test_public_theme_toggle_is_shared_and_persistent(self) -> None:
        context = self.browser.new_context(color_scheme='light')
        page = context.new_page()

        page.goto(f'{BASE_URL}/', wait_until='networkidle')
        toggle = page.get_by_role('button', name='切换到深色模式')
        self.assertEqual(toggle.count(), 1)
        toggle.click()
        page.locator('html.dark').wait_for()
        self.assertEqual(page.evaluate("localStorage.getItem('theme')"), 'dark')

        for route in ('/signin', '/download'):
            page.goto(f'{BASE_URL}{route}', wait_until='networkidle')
            self.assertEqual(
                page.get_by_role('button', name=re.compile(r'切换到(?:浅|深)色模式')).count(),
                1,
            )
            self.assertIn('dark', page.locator('html').get_attribute('class').split())

        context.close()

    def test_admin_and_portal_dialog_stay_dark_in_light_system(self) -> None:
        context = self.browser.new_context(color_scheme='light')
        page = context.new_page()

        def handle_api(route) -> None:
            url = route.request.url
            if '/api/v1/auth/refresh' in url:
                body = {'accessToken': admin_access_token(), 'expiresInSeconds': 900}
            elif '/api/v1/auth/me' in url:
                body = {
                    'id': 'admin-1',
                    'email': 'admin@example.invalid',
                    'role': 'admin',
                }
            elif '/api/v1/admin/users' in url:
                body = {
                    'items': [{
                        'id': 'user-1',
                        'name': 'Smoke User',
                        'email': 'smoke@example.invalid',
                        'role': 'user',
                        'createdAt': '2026-07-10T00:00:00.000Z',
                    }],
                    'page': 1,
                    'pageSize': 10,
                    'total': 1,
                }
            elif '/api/v1/users/user-1/storage' in url:
                body = {
                    'id': 'user-1',
                    'storageQuota': 10 * 1024 * 1024 * 1024,
                    'storageUsed': 2 * 1024 * 1024 * 1024,
                }
            else:
                body = {}
            route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

        page.route('**/api/v1/**', handle_api)
        page.goto(f'{BASE_URL}/admin/users', wait_until='networkidle')

        card_background = page.locator('[class*="bg-nothing-glass"]').first.evaluate(
            'element => getComputedStyle(element).backgroundColor'
        )
        self.assertEqual(card_background, 'rgba(16, 16, 16, 0.9)')

        page.get_by_role('button', name='存储').click()
        dialog = page.get_by_role('dialog')
        dialog.wait_for()
        dialog_background = dialog.evaluate('element => getComputedStyle(element).backgroundColor')
        dialog_color = dialog.evaluate('element => getComputedStyle(element).color')
        self.assertEqual(dialog_background, 'rgb(14, 14, 14)')
        self.assertEqual(dialog_color, 'rgb(237, 237, 237)')

        context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
