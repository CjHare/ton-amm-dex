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

### Deploy or run another script
```bash
yarn blueprint run
```

### Add a new contract
```bash
yarn blueprint create ContractName
```

### TypeScript formatting
Prettier formatter currently lacks a FunC plugin.
To format the TypeScript files:
```bash
yarn format
```


## Web2 references
Web2 URI references existing within the FunC code

```bash
grep -r "ston.fi" --include="*.fc" .
```
