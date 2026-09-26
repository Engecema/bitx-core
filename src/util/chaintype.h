// Copyright (c) 2023-present The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITX_UTIL_CHAINTYPE_H
#define BITX_UTIL_CHAINTYPE_H

#include <optional>
#include <string>
#include <string_view>

enum class ChainType {
    MAIN,
    TESTNET,
    SIGNET,
    REGTEST,
    TESTNET4,
};

std::string ChainTypeToString(ChainType chain);

std::optional<ChainType> ChainTypeFromString(std::string_view chain);

#endif // BITX_UTIL_CHAINTYPE_H
