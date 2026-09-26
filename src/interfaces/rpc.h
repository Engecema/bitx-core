// Copyright (c) 2025 The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITX_INTERFACES_RPC_H
#define BITX_INTERFACES_RPC_H

#include <memory>
#include <string>

class UniValue;

namespace node {
struct NodeContext;
} // namespace node

namespace interfaces {
//! Interface giving clients ability to emulate HTTP RPC calls.
class Rpc
{
public:
    virtual ~Rpc() = default;
    virtual UniValue executeRpc(UniValue request, std::string url, std::string user) = 0;
};

//! Return implementation of Rpc interface.
std::unique_ptr<Rpc> MakeRpc(node::NodeContext& node);

} // namespace interfaces

#endif // BITX_INTERFACES_RPC_H
