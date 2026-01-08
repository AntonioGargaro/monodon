# @antoniog/rust

A Nx plugin that adds support for Cargo and Rust in your Nx workspace.

## Compatibility Chart
|@antoniog/rust|nx|
|---|---
|<=1.2.1|<=17.1.0|
|>=1.3.0|>=17.1.0|


## Getting Started

### Prerequisites
The following tools need to be installed on your system to take full advantage of `@antoniog/rust`
* Node (LTS)
* Rust / Cargo via [https://rustup.rs](https://rustup.rs)

### Install with `npx create-nx-workspace` preset
To bootstrap a new workspace with `@antoniog/rust` installed and ready, run:

```shell
npx create-nx-workspace --preset=@antoniog/rust
```

### Installation in already set up workspace
Use your favourite package manager to install in your project:

```shell
yarn add -D @antoniog/rust
```

```shell
npm install -D @antoniog/rust
```

```shell
pnpm add -D @antoniog/rust
```

#### Initialization

After installing, you can run any of the project generators (binary, library) to have @antoniog/rust set up Cargo in your workspace.

## Generators
Use Nx Console to see the full list of options for each generator.

### `@antoniog/rust:binary`
Creates a Rust binary application to be run independently.

> Create a new binary:
> ```shell
> nx generate @antoniog/rust:binary my-rust-app
> ```

### `@antoniog/rust:library`
Creates a Rust library that can be used in binaries, or compiled to be used for napi.

> Create a new library:
> ```shell
> nx generate @antoniog/rust:library my-rust-lib
> ```

> Create a new library with napi:
> ```shell
> nx generate @antoniog/rust:library my-rust-node-lib --napi
> ```

#### Napi
Generating a library with the `--napi` flag will set up the project to be built with it.

## Executors
All the executors support these additional properties:
* toolchain: (e.g. `--toolchain='stable' | 'beta' | 'nightly'`);
  * Uses `stable` by default
* target (e.g. `--target=aarch64-apple-darwin`);
* profile (e.g. `--profile=dev`)
  * [Cargo profiles](https://doc.rust-lang.org/cargo/reference/profiles.html)
* release
* target-dir
* features (e.g. `--features=bmp`)
  * [Cargo features](https://doc.rust-lang.org/cargo/reference/features.html)
* all-features
* args
  * [Arguments forwarding](https://nx.dev/nx-api/nx/executors/run-commands#args) to the executor.

### `@antoniog/rust:build`
Runs cargo to build the project
> Not supported with napi

### `@antoniog/rust:lint`
Runs cargo clippy to lint the project

### `@antoniog/rust:napi`
Runs the napi cli to build the project

### `@antoniog/rust:run`
Runs `cargo run` for the project
> Not supported with napi

### `@antoniog/rust:test`
Runs `cargo test` for the project
