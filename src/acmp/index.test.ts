import test from "node:test";
import { Client } from ".";
import { FullClient as acksp, ReadOnlyClient as ackspRO } from 'acksp-js'
import { ACESS, ECDHWalletExtension } from 'acess-js'
import { AccountAddress, Network, Aptos, AptosConfig, Account, AnyRawTransaction, Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { SimpleMessage } from "../message";
import assert from "node:assert";

let initCalled: boolean = false
let sender: Ed25519Account
let reciever: Ed25519Account
let aptos: Aptos
let senderEnc: ACESS
let recieverEnc: ACESS
let recieverKS: acksp
let senderKS: acksp

async function init() {
    if (initCalled) {
        return
    }
    initCalled = true
    sender = Account.generate()
    reciever = Account.generate()
    const aptosConfig = new AptosConfig({ network: Network.TESTNET })
    aptos = new Aptos(aptosConfig)
    try {
        await aptos.fundAccount({ accountAddress: sender.accountAddress.toString(), amount: 1000000 })
    } catch {}
    try {
        await aptos.fundAccount({ accountAddress: reciever.accountAddress.toString(), amount: 1000000 })
    } catch {}
    const senderkeys = await createKeys(sender)
    const recieverkeys = await createKeys(reciever)
    senderEnc = senderkeys.encryptor
    recieverEnc = recieverkeys.encryptor
    senderKS = senderkeys.keyservice
    recieverKS = recieverkeys.keyservice
}

async function createKeys(reciever: Ed25519Account) {
    const keyservice = new acksp(
        AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6"),
        aptos as Aptos,
        {
            accountAddress: (reciever as Account).accountAddress,
            signTransaction: async (txn: AnyRawTransaction) => {
                return (reciever as Account).signTransactionWithAuthenticator(txn)
            },
        }
    )
    const encryptor = new ACESS(new ECDHWalletExtension((reciever as Ed25519Account).privateKey.toUint8Array()))
    await keyservice.publishKey({ encryptor: encryptor })
    return { encryptor, keyservice }
}

test("create store", async () => {
    await init()
    const acmp = new Client({
        encryptor: async (timestamp?: number) => {
            return recieverEnc
        },
        keyservice: new ackspRO(
            AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6"),
            aptos as Aptos,
        ),
        signer: {
            accountAddress: reciever.accountAddress,
            signTransaction: async (txn: AnyRawTransaction) => {
                return reciever.signTransactionWithAuthenticator(txn)
            },

        },
        aptos: aptos,
        contractAddress: AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6")
    })
    await acmp.createStore()
})

test("send message", async () => {
    await init()
    const acmp = new Client({
        encryptor: senderKS.createACESS.bind(senderKS, sender.accountAddress, senderEnc),
        keyservice: new ackspRO(
            AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6"),
            aptos as Aptos,
        ),
        signer: {
            accountAddress: reciever.accountAddress,
            signTransaction: async (txn: AnyRawTransaction) => {
                return reciever.signTransactionWithAuthenticator(txn)
            },

        },
        aptos: aptos,
        contractAddress: AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6")
    })
    await acmp.sendMessage(reciever.accountAddress, (new SimpleMessage("hello man!!", [])).toRawMessage())
})

test("recieve message", async () => {
    await init()
    const acmp = new Client({
        encryptor: recieverKS.createACESS.bind(recieverKS, reciever.accountAddress, recieverEnc),
        keyservice: new ackspRO(
            AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6"),
            aptos as Aptos,
        ),
        signer: {
            accountAddress: reciever.accountAddress,
            signTransaction: async (txn: AnyRawTransaction) => {
                return reciever.signTransactionWithAuthenticator(txn)
            },

        },
        aptos: aptos,
        contractAddress: AccountAddress.fromString("0xb60fd39de7a42e40bc1393a72f5212334c178e318248bc85138fc82fc34c8ef6")
    })
    const msgs = await acmp.getMessages(0)
    if (msgs.length != 1) {
        assert(false)
    }
    assert(msgs[0].from.toString() === sender.accountAddress.toString())
    assert(SimpleMessage.fromMessage(msgs[0].message).text === "hello man!!")
    assert(SimpleMessage.fromMessage(msgs[0].message).attachments.length === 0)
})
