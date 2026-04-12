declare module 'imapflow' {
  export interface ImapFlowOptions {
    host: string
    port: number
    secure: boolean
    auth: { user: string; pass: string }
    logger?: boolean | object
  }

  export interface MessageAddressObject {
    address?: string
    name?: string
  }

  export interface MessageEnvelopeObject {
    date?: Date
    subject?: string
    messageId?: string
    inReplyTo?: string
    from?: MessageAddressObject[]
    to?: MessageAddressObject[]
  }

  export interface FetchMessageObject {
    uid: number
    source?: Buffer
    envelope?: MessageEnvelopeObject
  }

  export interface MailboxLockObject {
    release: () => void
  }

  export class ImapFlow {
    constructor(options: ImapFlowOptions)
    connect(): Promise<void>
    logout(): Promise<void>
    getMailboxLock(path: string): Promise<MailboxLockObject>
    search(criteria: object): Promise<number[] | false>
    fetch(
      range: number[] | string,
      query: { envelope?: boolean; source?: boolean; bodyStructure?: boolean },
      options?: { uid?: boolean }
    ): AsyncIterable<FetchMessageObject>
  }
}
