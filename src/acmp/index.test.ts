import test from "node:test";
import { Client } from ".";
import { FullClient as acksp, ReadOnlyClient as ackspRO } from 'acksp-js'
import { ACESS, ECDHWalletExtension } from 'acess-js'
import { AccountAddress, Network, Aptos, AptosConfig, Account, AnyRawTransaction, Ed25519Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { SimpleMessage } from "../message";
import assert from "node:assert";
import { env } from "node:process";

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
    const coins = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(env["PKEY"] as string)
    })
    sender = Account.generate()
    console.log(sender.privateKey.toString())
    reciever = Account.generate()
    console.log(reciever.privateKey.toString())
    const aptosConfig = new AptosConfig({ network: Network.TESTNET })
    aptos = new Aptos(aptosConfig)
    const txn1 = await aptos.signAndSubmitTransaction({
        signer: coins, transaction: await aptos.transaction.build.simple({
            sender: coins.accountAddress,
            data: {
                function: "0x1::aptos_account::transfer",
                functionArguments: [sender.accountAddress, 50000000]
            }
        })
    })
    await aptos.waitForTransaction({transactionHash: txn1.hash})
    const txn2 = await aptos.signAndSubmitTransaction({
        signer: coins, transaction: await aptos.transaction.build.simple({
            sender: coins.accountAddress,
            data: {
                function: "0x1::aptos_account::transfer",
                functionArguments: [reciever.accountAddress, 50000000]
            }
        })
    })
    await aptos.waitForTransaction({transactionHash: txn2.hash})
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
            accountAddress: sender.accountAddress,
            signTransaction: async (txn: AnyRawTransaction) => {
                return sender.signTransactionWithAuthenticator(txn)
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
