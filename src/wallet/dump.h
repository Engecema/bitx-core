// Copyright (c) 2020-present The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITX_WALLET_DUMP_H
#define BITX_WALLET_DUMP_H

#include <util/fs.h>

#include <string>

struct bilingual_str;
class ArgsManager;

namespace wallet {
class WalletDatabase;

bool DumpWallet(const ArgsManager& args, WalletDatabase& db, bilingual_str& error);
bool CreateFromDump(const ArgsManager& args, const std::string& name, const fs::path& wallet_path, bilingual_str& error);
} // namespace wallet

#endif // BITX_WALLET_DUMP_H
