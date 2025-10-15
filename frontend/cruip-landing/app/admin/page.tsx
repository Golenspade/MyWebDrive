import { redirect } from 'next/navigation'

export default function AdminIndex() {
  // Redirect to admin overview by default
  redirect('/admin/overview')
}
