import { Address, Cell } from "@ton/core"
import { AccountStateActive } from "@ton/core/dist/types/AccountState"
import { Blockchain } from "@ton/sandbox"

/**
 * Expects the code of the contract at the given address to match that given
 */
export async function expectCodeEqualsCell(blockchain: Blockchain, contract:Address, expectedCode:Cell)
{
  const state = (await blockchain.getContract(contract)).accountState
  expect(state?.type).toBeDefined
  expect(state?.type).toBe('active')
  if(state?.type == 'active'){
  const code =  (state as AccountStateActive).state.code
  expect(code).toBeDefined
    expect(code).toEqualCell(expectedCode)
  }
}
