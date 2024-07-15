import test from 'node:test'
import assert from 'node:assert'
import { Header, RawMessage } from './raw_message'
import { MessageType } from './msg_types'
import { Account } from '@aptos-labs/ts-sdk'

function checkEqality(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length != b.length) {
        return false
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false
        }
    }
    return true
}

test("Header_toUint8Array", async () => {
    const h = new Header(1, MessageType.SimpleMessage)
    const sH = h.toUint8Array()
    assert.equal(checkEqality(sH, new Uint8Array([0x00, 0x00, 0x11])), true)
})
test("Header_fromUint8Array", async () => {
    const ac = Account.generate().accountAddress
    const sH = new Uint8Array([0x00, 0x00, 0x11])
    const h = Header.fromUint8Array(sH)
    assert.equal(h.msg_type, MessageType.SimpleMessage)
    assert.equal(h.version, 1)
})

test("RawMessage_toUint8Array", async () => {
    const sH = new Uint8Array([0x00, 0x00, 0x11])
    const message = new RawMessage(new Header(1, MessageType.SimpleMessage), Buffer.from("hello world"))
    const sMsg = message.toUint8Array()
    assert(checkEqality(sMsg.slice(0, 3), sH))
    assert(checkEqality(sMsg.slice(3), Buffer.from("hello world")))
})

test("RawMessage_fromUint8Array", async () => {
    const sMsg = new Uint8Array([0x00, 0x00, 0x11, 0x41, 0x41])
    const msg = RawMessage.fromUint8Array(sMsg)
    assert(msg.header.version === 1)
    assert(msg.header.msg_type === MessageType.SimpleMessage)
    assert(checkEqality(msg.payload, Buffer.from("AA")))
})
