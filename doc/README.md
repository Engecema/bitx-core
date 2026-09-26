BitX Core
=============

Setup
---------------------
BitX Core is the original BitX client and it builds the backbone of the network. It downloads and, by default, stores the entire history of BitX transactions, which requires several hundred gigabytes or more of disk space. Depending on the speed of your computer and network connection, the synchronization process can take anywhere from a few hours to several days or more.

To download BitX Core, visit [bitxcore.org](https://bitxcore.org/en/download/).

Running
---------------------
The following are some helpful notes on how to run BitX Core on your native platform.

### Unix

Unpack the files into a directory and run:

- `bin/bitx-qt` (GUI) or
- `bin/bitxd` (headless)
- `bin/bitx` (wrapper command)

The `bitx` command supports subcommands like `bitx gui`, `bitx node`, and `bitx rpc` exposing different functionality. Subcommands can be listed with `bitx help`.

### Windows

Unpack the files into a directory, and then run bitx-qt.exe.

### macOS

Drag BitX Core to your applications folder, and then run BitX Core.

### Need Help?

* See the documentation at the [BitX Wiki](https://en.bitx.it/wiki/Main_Page)
for help and more information.
* Ask for help on [BitX StackExchange](https://bitx.stackexchange.com).
* Ask for help on #bitx on Libera Chat. If you don't have an IRC client, you can use [web.libera.chat](https://web.libera.chat/#bitx).
* Ask for help on the [BitXTalk](https://bitxtalk.org/) forums, in the [Technical Support board](https://bitxtalk.org/index.php?board=4.0).

Building
---------------------
The following are developer notes on how to build BitX Core on your native platform. They are not complete guides, but include notes on the necessary libraries, compile flags, etc.

- [Dependencies](dependencies.md)
- [macOS Build Notes](build-osx.md)
- [Unix Build Notes](build-unix.md)
- [Windows Build Notes](build-windows-msvc.md)
- [FreeBSD Build Notes](build-freebsd.md)
- [OpenBSD Build Notes](build-openbsd.md)
- [NetBSD Build Notes](build-netbsd.md)

Development
---------------------
The BitX repo's [root README](/README.md) contains relevant information on the development process and automated testing.

- [Developer Notes](developer-notes.md)
- [Productivity Notes](productivity.md)
- [Release Process](release-process.md)
- [Source Code Documentation (External Link)](https://doxygen.bitxcore.org/)
- [Translation Process](translation_process.md)
- [Translation Strings Policy](translation_strings_policy.md)
- [JSON-RPC Interface](JSON-RPC-interface.md)
- [Unauthenticated REST Interface](REST-interface.md)
- [BIPS](bips.md)
- [Dnsseed Policy](dnsseed-policy.md)
- [Benchmarking](benchmarking.md)
- [Internal Design Docs](design/)

### Resources
* Discuss on the [BitXTalk](https://bitxtalk.org/) forums, in the [Development & Technical Discussion board](https://bitxtalk.org/index.php?board=6.0).
* Discuss project-specific development on #bitx-core-dev on Libera Chat. If you don't have an IRC client, you can use [web.libera.chat](https://web.libera.chat/#bitx-core-dev).

### Miscellaneous
- [Assets Attribution](assets-attribution.md)
- [bitx.conf Configuration File](bitx-conf.md)
- [CJDNS Support](cjdns.md)
- [Files](files.md)
- [Fuzz-testing](fuzzing.md)
- [I2P Support](i2p.md)
- [Init Scripts (systemd/upstart/openrc)](init.md)
- [Managing Wallets](managing-wallets.md)
- [Multisig Tutorial](multisig-tutorial.md)
- [Offline Signing Tutorial](offline-signing-tutorial.md)
- [P2P bad ports definition and list](p2p-bad-ports.md)
- [PSBT support](psbt.md)
- [Reduce Memory](reduce-memory.md)
- [Reduce Traffic](reduce-traffic.md)
- [Tor Support](tor.md)
- [Transaction Relay Policy](policy/README.md)
- [ZMQ](zmq.md)

License
---------------------
Distributed under the [MIT software license](/COPYING).
