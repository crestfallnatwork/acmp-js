import { AccountAddress } from '@aptos-labs/ts-sdk'
import { bytesToUint, uintToBytes } from '../utils/intsToBytes'
import { MessageType } from './msg_types'

export const InvalidInput = new Error("invalid input")

export class Header {
    public readonly version: number
    public readonly msg_type: MessageType
    private internal: Uint8Array | undefined
    private serialize(): Uint8Array {
        this.internal = new Uint8Array(3)
        let raw = 0x000000
        raw = (this.version << 4) + (this.msg_type)
        this.internal.set(uintToBytes(raw, 3))
        return this.internal
    }
    constructor(version: number, msg_type: MessageType) {
        this.version = version % (1 << 4)
        this.msg_type = msg_type % (1 << 20)
    }
    toUint8Array(): Uint8Array {
        if (this.internal === undefined) {
            return this.serialize()
        }
        return this.internal
    }
    static fromUint8Array(header: Uint8Array): Header {
        if(header.length != 3) {
            throw InvalidInput
        }
        const headerInt = bytesToUint(header.slice(0,3))
        const version = (headerInt & 0x00000f)
        const msg_type = (headerInt >> 4)
        const ret = new Header(version, msg_type)
        ret.internal = header
        return ret
    }
}

export class RawMessage {
    header: Header
    payload: Uint8Array
    constructor(header: Header, payload: Uint8Array) {
        this.header = header
        this.payload = payload
    }
    toUint8Array(): Uint8Array {
        const headerBytes = this.header.toUint8Array()
        const res = new Uint8Array(headerBytes.length + this.payload.length)
        res.set(headerBytes)
        res.set(this.payload, headerBytes.length)
        return res
    }
    static fromUint8Array(msg: Uint8Array): RawMessage {
        const header = Header.fromUint8Array(msg.slice(0, 3))
        const payload = msg.slice(3)
        return new RawMessage(header, payload)
    }
}
