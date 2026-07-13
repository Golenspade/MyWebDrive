export async function readLatestMailbox({ baseUrl, recipient, token }) {
  const url = new URL('/v1/test/mailboxes/latest', baseUrl)
  url.searchParams.set('recipient', recipient)
  const response = await fetch(url, {
    headers: { 'X-Test-Mailbox-Token': token },
  })
  if (!response.ok) throw new Error(`test mailbox returned HTTP ${response.status}`)
  const message = await response.json()
  if (
    message?.to !== recipient ||
    typeof message?.code !== 'string' ||
    !/^\d{6}$/.test(message.code)
  ) {
    throw new Error('test mailbox returned an invalid recipient-scoped message')
  }
  return message
}
