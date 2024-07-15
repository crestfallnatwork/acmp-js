import { AccountAddress, Ed25519PublicKey } from "@aptos-labs/ts-sdk";
import { ACESS } from "acess-js";

export interface SenderInterface {
    send(to: AccountAddress, encryptedMsg: Uint8Array): Promise<void>
}

export interface RecieverInterface {
    recieve(from: AccountAddress, start: number, end?: number): Promise<{
        msg: Uint8Array,
        timestamp: number
    }[]>
}

export interface KeyServerInterface {
    fetchKey(whose: AccountAddress, timestamp?: number): Promise<Ed25519PublicKey>
}
