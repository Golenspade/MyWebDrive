import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


class PasswordlessAuthSourceContractTest(unittest.TestCase):
    def test_store_uses_core_passwordless_cookie_session_contract(self) -> None:
        auth_store = source('lib/stores/auth-store.ts')
        auth_api = source('lib/api/auth.ts')
        auth_surface = auth_store + auth_api

        self.assertNotIn('localStorage', auth_store)
        self.assertNotIn('refreshToken', auth_store)
        self.assertNotIn('persist(', auth_store)
        self.assertIn('requestEmailCode', auth_store)
        self.assertIn('verifyEmailCode', auth_store)
        self.assertIn('/auth/email/request', auth_surface)
        self.assertIn('/auth/email/verify', auth_surface)
        self.assertIn('/auth/refresh', auth_surface)
        self.assertIn('/auth/me', auth_surface)
        self.assertIn('/auth/logout', auth_surface)
        self.assertIn('bootstrap', auth_store)

    def test_api_client_sends_cookie_and_single_flights_refresh(self) -> None:
        api_client = source('lib/api/client.ts')

        self.assertIn("credentials: 'include'", api_client)
        self.assertIn('refreshPromise', api_client)
        self.assertIn('Authorization', api_client)

    def test_signin_is_two_step_six_digit_otp_with_memory_only_challenge(self) -> None:
        signin = source('app/(auth)/signin/page.tsx')

        self.assertNotIn("type='password'", signin)
        self.assertNotIn('localStorage', signin)
        self.assertIn("type Step = 'email' | 'code'", signin)
        self.assertIn('challengeId', signin)
        self.assertIn('resendAfterSeconds', signin)
        self.assertIn('maxLength={6}', signin)
        self.assertIn("inputMode='numeric'", signin)
        self.assertIn("router.push('/admin/overview')", signin)
        self.assertIn("router.push('/account')", signin)

    def test_obsolete_signup_reset_and_invitation_surfaces_are_removed(self) -> None:
        signup = source('app/(auth)/signup/page.tsx')
        reset = source('app/(auth)/reset-password/page.tsx')
        menubar = source('app/admin/components/admin-menubar.tsx')
        admin_api = source('lib/api/admin.ts')

        self.assertIn("redirect('/signin')", signup)
        self.assertIn("redirect('/signin')", reset)
        self.assertFalse((ROOT / 'app/(auth)/reset-password/reset-password-form.tsx').exists())
        self.assertFalse((ROOT / 'app/admin/invitations/page.tsx').exists())
        self.assertNotIn('invitation', signup.lower())
        self.assertNotIn('invitation', menubar.lower())
        self.assertNotIn('invitation', admin_api.lower())

    def test_notification_stream_never_places_bearer_in_query_string(self) -> None:
        notifications = source('app/admin/notifications/page.tsx')

        self.assertNotIn('EventSource', notifications)
        self.assertNotIn('access_token=', notifications)
        self.assertIn("fetch('/api/v1/admin/notifications/stream'", notifications)
        self.assertIn('Authorization: `Bearer ${accessToken}`', notifications)

    def test_account_does_not_persist_or_expose_access_token(self) -> None:
        account = source('app/account/page.tsx')
        upload_panel = source('components/upload/upload-panel.tsx')

        self.assertNotIn('localStorage', account)
        self.assertNotIn('copyToken', account)
        self.assertNotIn('访问令牌', account)
        self.assertNotIn('/users/me', account)
        self.assertNotIn('/users/me', upload_panel)

    def test_legacy_auth_api_has_no_password_or_body_refresh_contract(self) -> None:
        auth_api = source('lib/api/auth.ts')
        auth_docs = ''.join([
            source('content/api/authentication.mdx'),
            source('content/api/reference.mdx'),
            source('content/api/examples.mdx'),
        ])

        self.assertNotIn('password', auth_api.lower())
        self.assertNotIn('refreshToken', auth_api)
        self.assertIn("'/auth/email/request'", auth_api)
        self.assertIn("'/auth/email/verify'", auth_api)
        self.assertIn("'/auth/refresh'", auth_api)
        self.assertNotIn('/auth/login', auth_docs)
        self.assertNotIn('/auth/register', auth_docs)
        self.assertNotIn('refreshToken', auth_docs)
        self.assertNotIn('/users/me/password', auth_docs)


if __name__ == '__main__':
    unittest.main(verbosity=2)
