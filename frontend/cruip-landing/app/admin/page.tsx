import { redirect } from "next/navigation"

export default function AdminIndex() {
  // Redirect to admin users management by default
  redirect("/admin/users")
}

