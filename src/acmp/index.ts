import { AccountAddress, Aptos, AnyRawTransaction, AccountAuthenticator, InputViewFunctionData } from "@aptos-labs/ts-sdk"
import { ACESSLike, toX25519PubKey } from 'acess-js'
import { RawMessage } from "../message"
import { KeyServerInterface } from "../sender"
import { hexToBytes } from 'web3-utils'

type OnChainMessage = {
    from: string,
    payload: string,
    timestamp: number
}

export interface SignerInterface {
    signTransaction(txn: AnyRawTransaction): Promise<AccountAuthenticator>
    accountAddress: AccountAddress
}
type GetEncryptor = (timestamp?: number) => Promise<ACESSLike>

export class Client {
    private encryptor: GetEncryptor
    private keyservice: KeyServerInterface
    private aptos: Aptos
    private signer: SignerInterface
    private contractAddress: string
    constructor(config: {
        keyservice: KeyServerInterface
        signer: SignerInterface
        aptos: Aptos
        contractAddress: AccountAddress
        encryptor: GetEncryptor
    }) {
        this.encryptor = config.encryptor
        this.keyservice = config.keyservice
        this.aptos = config.aptos
        this.signer = config.signer
        this.contractAddress = config.contractAddress.toString()
    }
    private async send(theirAccount: AccountAddress, message: Uint8Array) {
        const txn = await this.aptos.transaction.build.simple({
            sender: this.signer.accountAddress,
            data: {
                function: `${this.contractAddress}::acmp::send_message`,
                functionArguments: [theirAccount, message]
            }
        })
        const signedTxn = await this.signer.signTransaction(txn)
        const pendingTxn = await this.aptos.transaction.submit.simple({
            transaction: txn,
            senderAuthenticator: signedTxn
        })
        await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash })
    }
    private async recieve(start: number, end?: number): Promise<OnChainMessage[]> {
        if (end === undefined) {
            end = 0
        }
        const payload: InputViewFunctionData = {
            function: `${this.contractAddress}::acmp::get_messages`,
            functionArguments: [this.signer.accountAddress, start, end],
        }
        const ret = await this.aptos.view({ payload })
        const msgs = (ret[0] as OnChainMessage[])
        return msgs
    }
    public async sendMessage(theirAccount: AccountAddress, message: RawMessage) {
        const theirPublicKey = await this.keyservice.fetchKey(theirAccount)
        const encryptedMsg = await (await this.encryptor())
            .encrypt(message.toUint8Array(), toX25519PubKey(theirPublicKey))
        await this.sendMessageRaw(theirAccount, encryptedMsg)
    }
    public async sendMessageRaw(theirAccount: AccountAddress, message: Uint8Array) {
        await this.send(theirAccount, message)
    }
    public async createStore() {
        const txn = await this.aptos.transaction.build.simple({
            sender: this.signer.accountAddress,
            data: {
                function: `${this.contractAddress}::acmp::create_store`,
                functionArguments: []
            }
        })
        const signedTxn = await this.signer.signTransaction(txn)
        const pendingTxn = await this.aptos.transaction.submit.simple({
            transaction: txn,
            senderAuthenticator: signedTxn
        })
        await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash })
    }
    public async getMessages(start: number, end?: number): Promise<{
        from: AccountAddress,
        timestamp: number,
        message: RawMessage
    }[]> {
        const rawMsgs = await this.recieve(start, end)
        return await Promise.all(rawMsgs.map(async (v) => {
            const thierPublicKey = await this.keyservice.fetchKey(AccountAddress.fromString(v.from), v.timestamp)
            const decryptedMsg = await (await this.encryptor())
                .decrypt(hexToBytes(v.payload), toX25519PubKey(thierPublicKey))
            return {
                from: AccountAddress.fromString(v.from),
                timestamp: v.timestamp,
                message: RawMessage.fromUint8Array(decryptedMsg)
            }
        }))
    }
}
