import test from 'node:test'
import assert from 'node:assert'
import { bytesToUint } from './intsToBytes'

test("bytesToUint", async () => {
    assert.equal(bytesToUint(new Uint8Array([0xff, 0xff, 0x00])), 0xffff00)
})
