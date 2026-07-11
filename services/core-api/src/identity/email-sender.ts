export type SendOtpInput = {
  to: string
  code: string
  ttlSeconds: 600
  purpose: 'login'
}

export interface EmailSender {
  sendOtp(input: SendOtpInput): Promise<void>
}

type EmailSenderOptions = {
  providerUrl: string
  token: string
  fetchImpl?: typeof fetch
}

export function createEmailSender(options: EmailSenderOptions): EmailSender {
  const fetchImpl = options.fetchImpl ?? fetch
  const endpoint = `${options.providerUrl.replace(/\/$/, '')}/v1/messages/otp`

  return {
    async sendOtp(input) {
      let response: Response
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        })
      } catch {
        throw new Error('email provider unavailable')
      }

      if (!response.ok) throw new Error('email provider unavailable')
    },
  }
}
