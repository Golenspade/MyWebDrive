import { redirect } from 'next/navigation'

export default function RootRedirect() {
  // Redirect root to the admin overview (MVP entry)
  redirect('/admin/overview')
}
