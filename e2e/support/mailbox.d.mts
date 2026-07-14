export interface TestMailboxMessage {
  to: string
  code: string
}

export function readLatestMailbox(input: {
  baseUrl: string
  recipient: string
  token: string
}): Promise<TestMailboxMessage>
