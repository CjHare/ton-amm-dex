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

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`
