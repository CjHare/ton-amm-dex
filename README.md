# ton-amm-dex
FunC decentralised exchange (DEX) for the The Open Network (TON)

Fork of [Ston FI](https://github.com/ston-fi/dex-core) at hash [6ab5b1c](https://github.com/ston-fi/dex-core/commit/6ab5b1cb3ddb6a37a070f980bae84acbb0197814), ported into the [Blueprint SDK](https://github.com/ton-org/blueprint) structure.

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Build
```bash
yarn blueprint build
```

### Test
```bash
yarn blueprint test
```

### Run script (e.g. Deploy, Getter, Tx)
```bash
yarn blueprint run
```

### TypeScript formatting
Prettier formatter currently lacks a FunC plugin.
To format the TypeScript files:
```bash
yarn format
```

## Contract Ownership
Only the `Router` contract can be owned, with the `Pool`, `LpAccount` and `LpWallet` being permissionless.

The owner of the `Router` is given on contract deployment as the `adminAddress` property.

Admin powers:
- Collecting Protocol Fees (from pools)
- Locking and Unlocking the `Router` (by extension the default entry point to the pools)
- Code upgrade (inc cancel/confirmation)
- Owership transfer (inc cancel/confirmation)
- Resetting `Router` gas (withdraws excess TON held by the `Router` to the admin, leaving `REQUIRED_TON_RESERVE`)
- Restting any `Pool` gas (withdraws excess TO held by the `Pool` to the `Router`, leaving `REQUIRED_TON_RESERVE`)

### Transfer Ownership
A two step process with a two day timelock that only involves the current admin (the new admin DOES NOT send the conform).
1. `Router` admin sends a tx with `body: router.initAdminUpgrade({newAdmin: updateAdminAddress}),`
2. After two days, the `Router` admins sends a tx with `body: router.finalizeUpgrades()`

## Contract Upgradability
Only the `Router` contract is upgradable, with the `Pool`, `LpAccout` and `LpWallet` immutable. 

The upgrade mechanism is two step, with a seven day timelock:
1. `Router` admin sends a tx with `body: router.initCodeUpgrade({ newCode: beginCell().storeInt(BigInt('10'), 32).endCell()}),` (`storeInt(BigInt('10'), 32)` being the contract code to replace the existing code with).
2. After seven days, the `Router` admin sends a tx with `body: router.finalizeUpgrades()` to apply the upgrade.

## Wrapper inconsistent with Blueprint
The classes under `wrapper/` are not inline with the Blueprint standard.

The port is pretty close to original functionality of using the wrappers to create the Cells, instead of actually invoking the function on that deployed contract.

## Web2 references
Web2 URI references existing within the FunC code

```bash
grep -r "ston.fi" --include="*.fc" .
```
