import { redirect } from 'next/navigation'

export default function RootRedirect() {
  // Redirect root to the public downloads/catalog page by default
  redirect('/download')
}
