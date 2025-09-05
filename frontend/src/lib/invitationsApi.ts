import api from '@/lib/api'

export interface InvitationCode {
  id: string
  code: string
  issuedBy: string
  issuedAt: string
  expiresAt?: string | null
  usageLimit: number
  usedCount: number
  isActive: boolean
  usedBy?: string | null
  usedAt?: string | null
  notes?: string | null
}

export async function listInvitations(): Promise<InvitationCode[]> {
  const { data } = await api.get('/auth/invitations')
  return data as InvitationCode[]
}

export async function createInvitation(params: { usageLimit?: number; expiresAt?: string; notes?: string }) {
  const { data } = await api.post('/auth/invitations', params ?? {})
  return data as InvitationCode
}

export async function revokeInvitation(code: string) {
  await api.post(`/auth/invitations/${encodeURIComponent(code)}/revoke`)
}

