import { Blockchain, SandboxContract } from "@ton/sandbox"
import { Router } from "../../wrappers/Router"
import { Cell, TupleItemInt, TupleItemSlice } from "@ton/core"

/**
 * Get the router data, deserialize it, extracting the upgrade data cell.
 */
export async function routerDataUpgradeCode(blockchain: Blockchain, router:SandboxContract<Router>):Promise<Cell>
{
    const call = await blockchain.runGetMethod(router.address, "get_router_data", [])
    const tempUpgrade = (call.stack[2] as TupleItemSlice).cell?.beginParse()
    tempUpgrade.loadUintBig(64)  // Code timelock
    tempUpgrade.loadUintBig(64) // Admin address timelock
    tempUpgrade.loadAddress() // Admin address
    return tempUpgrade.asCell().refs[0]  // Code (cell stored in a ref)
}

export enum LockState {
    unlocked, locked
}

/**
 * Get the router data, deserialize it, extracting the lock bit.
 */
export async function routerDataLockState(blockchain: Blockchain, router:SandboxContract<Router>):Promise<LockState>
{
    const call = await blockchain.runGetMethod(router.address, "get_router_data", [])
    return (call.stack[0] as TupleItemInt).value == 0n ?LockState.unlocked:LockState.locked
}