import test from "node:test";
import { SimpleMessage } from "./simple_message";
import assert from "node:assert";

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

test("SimpleMessage", () => {
    const msg = new SimpleMessage("hello man how are you", [{
        attachmentType: "text/plain;encoding=utf-8",
        data: Buffer.from("hello world")
    }])
    const sMsg = msg.toUint8Array()
    const unsMsg = SimpleMessage.fromUint8Array(sMsg)
    assert(unsMsg.text === msg.text)
    assert(unsMsg.attachments.length === msg.attachments.length)
    assert(unsMsg.attachments[0].attachmentType === msg.attachments[0].attachmentType)
    assert(checkEqality(unsMsg.attachments[0].data, msg.attachments[0].data))
})
