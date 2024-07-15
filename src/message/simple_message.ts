import { MessageType } from './msg_types'
import { RawMessage, Header } from './raw_message'
import { bytesToUint, uintToBytes } from '../utils/intsToBytes'
import { AccountAddress } from '@aptos-labs/ts-sdk'

export const InvalidPayload = new Error("invalid payload")
export const InvalidMessageHeader = new Error("invalid header")

export type Attachment = {
    attachmentType: string,
    data: Uint8Array
}
function encodeArray(bytes: Uint8Array): Uint8Array {
    const res = new Uint8Array(bytes.length + 4)
    res.set(uintToBytes(bytes.length, 4))
    res.set(bytes, 4)
    return res
}
function decodeArray(bytes: Uint8Array): { array: Uint8Array, rest: Uint8Array } {
    if (bytes.length < 4) {
        throw InvalidPayload
    }
    const size = bytesToUint(bytes.slice(0, 4))
    bytes = bytes.slice(4)
    if (bytes.length < size) {
        throw InvalidPayload
    }
    const array = bytes.slice(0, size)
    const rest = bytes.slice(size)
    return { array, rest }
}
function encodeString(text: string): Uint8Array {
    const bytes = new TextEncoder().encode(text)
    return encodeArray(bytes)
}
function decodeString(bytes: Uint8Array): { str: string, rest: Uint8Array } {
    const { array, rest } = decodeArray(bytes)
    const str = new TextDecoder().decode(array)
    return { str, rest }
}

function joinData(data: Uint8Array[]): Uint8Array {
    let size = 0
    for (const v of data.values()) {
        size += v.length
    }
    const res = new Uint8Array(size)
    let iter = 0
    for (const v of data.values()) {
        res.set(v, iter)
        iter += v.length
    }
    return res
}

export class SimpleMessage {
    readonly text: string
    readonly attachments: Attachment[]
    private internal: RawMessage | undefined
    private serialize(): RawMessage {
        const header = new Header(1, MessageType.SimpleMessage)
        const data: Uint8Array[] = []
        data.push(encodeString(this.text))
        this.attachments.forEach((attachment) => {
            data.push(encodeString(attachment.attachmentType))
            data.push(encodeArray(attachment.data))
        })
        const payload = joinData(data)
        this.internal = new RawMessage(header, payload)
        return this.internal
    }
    constructor(message: string, attachments: Attachment[]) {
        this.text = message
        this.attachments = attachments
    }
    toRawMessage(): RawMessage {
        if (this.internal === undefined) {
            return this.serialize()
        }
        return this.internal
    }
    toUint8Array(): Uint8Array {
        return this.toRawMessage().toUint8Array()
    }
    static fromMessage(msg: RawMessage): SimpleMessage {
        if (msg.header.msg_type != MessageType.SimpleMessage) {
            throw InvalidMessageHeader
        }
        if (msg.header.version != 1) {
            throw InvalidMessageHeader
        }
        const { text, attachments } = SimpleMessage.decodePayload(msg.payload)
        const ret = new SimpleMessage(text, attachments)
        ret.internal = msg
        return ret
    }
    static fromUint8Array(msg: Uint8Array): SimpleMessage {
        return SimpleMessage.fromMessage(RawMessage.fromUint8Array(msg))
    }
    private static decodePayload(payload: Uint8Array): { text: string, attachments: Attachment[] } {
        let { str, rest } = decodeString(payload)
        const text = str
        let array: Uint8Array
        const attachments: Attachment[] = []
        while (rest.length != 0) {
            ({ str, rest } = decodeString(rest));
            ({ array, rest } = decodeArray(rest));
            attachments.push({
                attachmentType: str,
                data: array
            })
        }
        return { text, attachments }
    }
}
