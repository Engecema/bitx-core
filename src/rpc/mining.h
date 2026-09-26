// Copyright (c) 2020-present The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITX_RPC_MINING_H
#define BITX_RPC_MINING_H

#include <cstdint>

/** Default max iterations to try in RPC generatetodescriptor, generatetoaddress, and generateblock. */
inline constexpr uint64_t DEFAULT_MAX_TRIES{1'000'000};

#endif // BITX_RPC_MINING_H
