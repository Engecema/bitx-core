# Copyright (c) 2023-present The BitX Core developers
# Distributed under the MIT software license, see the accompanying
# file COPYING or https://opensource.org/license/mit/.

include(AddWindowsResources)

configure_file(${PROJECT_SOURCE_DIR}/cmake/bitx-build-config.h.in bitx-build-config.h USE_SOURCE_PERMISSIONS @ONLY)
include_directories(${CMAKE_CURRENT_BINARY_DIR} ${CMAKE_CURRENT_SOURCE_DIR})

#=============================
# Subprojects
#=============================
# Subprojects include subdirectories that do or could have tests
# and/or benchmark binaries, such as all subtrees and univalue.
# These need to be included before CMAKE_*_OUTPUT_DIRECTORY variables
# are set, so output locations of subproject tests and libraries are
# not overridden.
include(../cmake/crc32c.cmake)
include(../cmake/leveldb.cmake)
include(../cmake/minisketch.cmake)
add_subdirectory(univalue)
if (ENABLE_IPC AND NOT WITH_EXTERNAL_LIBMULTIPROCESS)
  include(../cmake/libmultiprocess.cmake)
  add_libmultiprocess(ipc/libmultiprocess)
endif()
include(../cmake/secp256k1.cmake)
add_secp256k1(secp256k1)

# Set top-level target output locations.
if(NOT CMAKE_RUNTIME_OUTPUT_DIRECTORY)
  set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${PROJECT_BINARY_DIR}/bin)
endif()
if(NOT CMAKE_LIBRARY_OUTPUT_DIRECTORY)
  set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${PROJECT_BINARY_DIR}/lib)
endif()
if(NOT CMAKE_ARCHIVE_OUTPUT_DIRECTORY)
  set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${PROJECT_BINARY_DIR}/lib)
endif()

set(IS_SOURCE_TARBALL FALSE)
# git will expand the next line to "set(IS_SOURCE_TARBALL TRUE)" inside archives:
#$Format:%nset(IS_SOURCE_TARBALL TRUE)$
if(NOT IS_SOURCE_TARBALL AND PROJECT_IS_TOP_LEVEL)
  find_package(Git QUIET)
endif()
add_custom_target(generate_build_info
  BYPRODUCTS ${PROJECT_BINARY_DIR}/src/bitx-build-info.h
  COMMAND ${CMAKE_COMMAND} -DGIT_EXECUTABLE=${GIT_EXECUTABLE} -DBUILD_INFO_HEADER_PATH=${PROJECT_BINARY_DIR}/src/bitx-build-info.h -DSOURCE_DIR=${PROJECT_SOURCE_DIR} -P ${PROJECT_SOURCE_DIR}/cmake/script/GenerateBuildInfo.cmake
  COMMENT "Generating bitx-build-info.h"
  VERBATIM
)
add_library(bitx_clientversion STATIC
  clientversion.cpp
)
target_link_libraries(bitx_clientversion
  PRIVATE
    core_interface
)
add_dependencies(bitx_clientversion generate_build_info)

add_subdirectory(crypto)
add_subdirectory(util)
if(ENABLE_IPC)
  add_subdirectory(ipc)
else()
  add_library(bitx_ipc STATIC EXCLUDE_FROM_ALL ipc/stub.cpp)
endif()

add_library(bitx_consensus STATIC EXCLUDE_FROM_ALL
  arith_uint256.cpp
  consensus/merkle.cpp
  consensus/tx_check.cpp
  hash.cpp
  primitives/block.cpp
  primitives/transaction.cpp
  pubkey.cpp
  script/interpreter.cpp
  script/script.cpp
  script/script_error.cpp
  uint256.cpp
)
target_link_libraries(bitx_consensus
  PRIVATE
    core_interface
    bitx_crypto
    secp256k1
)

if(WITH_ZMQ)
  add_subdirectory(zmq)
endif()

# Home for common functionality shared by different executables and libraries.
# Similar to `bitx_util` library, but higher-level.
add_library(bitxcore_common STATIC EXCLUDE_FROM_ALL
  addresstype.cpp
  base58.cpp
  bech32.cpp
  chain.cpp
  chainparams.cpp
  chainparamsbase.cpp
  coins.cpp
  common/args.cpp
  common/bloom.cpp
  common/config.cpp
  common/init.cpp
  common/interfaces.cpp
  common/license_info.cpp
  common/messages.cpp
  common/netif.cpp
  common/pcp.cpp
  common/run_command.cpp
  common/settings.cpp
  common/signmessage.cpp
  common/system.cpp
  common/url.cpp
  compressor.cpp
  core_io.cpp
  deploymentinfo.cpp
  external_signer.cpp
  init/common.cpp
  kernel/chainparams.cpp
  key.cpp
  key_io.cpp
  merkleblock.cpp
  musig.cpp
  net_permissions.cpp
  net_types.cpp
  netaddress.cpp
  netbase.cpp
  outputtype.cpp
  policy/feerate.cpp
  policy/policy.cpp
  pow.cpp
  protocol.cpp
  psbt.cpp
  rpc/rawtransaction_util.cpp
  rpc/request.cpp
  rpc/util.cpp
  scheduler.cpp
  script/descriptor.cpp
  script/miniscript.cpp
  script/parsing.cpp
  script/sign.cpp
  script/signingprovider.cpp
  script/solver.cpp
)
target_link_libraries(bitxcore_common
  PRIVATE
    core_interface
    bitx_consensus
    bitx_util
    univalue
    secp256k1
    $<TARGET_NAME_IF_EXISTS:USDT::headers>
    $<$<PLATFORM_ID:Windows>:ws2_32>
)

include(InstallBinaryComponent)

if(ENABLE_WALLET)
  add_subdirectory(wallet)

  if(BUILD_WALLET_TOOL)
    add_executable(bitxcore-wallet
      bitx-wallet.cpp
      bitx-wallet-res.rc
      init/bitx-wallet.cpp
      wallet/wallettool.cpp
    )
    add_windows_application_manifest(bitxcore-wallet)
    target_link_libraries(bitxcore-wallet
      core_interface
      bitx_wallet
      bitxcore_common
      bitx_util
    )
    install_binary_component(bitxcore-wallet HAS_MANPAGE)
  endif()
endif()


# P2P and RPC server functionality used by `bitxd` and `bitx-qt` executables.
add_library(bitx_node STATIC EXCLUDE_FROM_ALL
  addrdb.cpp
  addrman.cpp
  banman.cpp
  bip324.cpp
  blockencodings.cpp
  blockfilter.cpp
  consensus/tx_verify.cpp
  dbwrapper.cpp
  deploymentstatus.cpp
  flatfile.cpp
  headerssync.cpp
  httprpc.cpp
  httpserver.cpp
  i2p.cpp
  index/base.cpp
  index/blockfilterindex.cpp
  index/coinstatsindex.cpp
  index/txindex.cpp
  index/txospenderindex.cpp
  init.cpp
  kernel/chain.cpp
  kernel/checks.cpp
  kernel/coinstats.cpp
  kernel/context.cpp
  kernel/cs_main.cpp
  kernel/disconnected_transactions.cpp
  kernel/mempool_removal_reason.cpp
  mapport.cpp
  net.cpp
  net_processing.cpp
  netgroup.cpp
  node/abort.cpp
  node/blockmanager_args.cpp
  node/blockstorage.cpp
  node/caches.cpp
  node/chainstate.cpp
  node/chainstatemanager_args.cpp
  node/coin.cpp
  node/coins_view_args.cpp
  node/connection_types.cpp
  node/context.cpp
  node/database_args.cpp
  node/eviction.cpp
  node/interface_ui.cpp
  node/interfaces.cpp
  node/kernel_notifications.cpp
  node/mempool_args.cpp
  node/mempool_persist.cpp
  node/mempool_persist_args.cpp
  node/miner.cpp
  node/mining_args.cpp
  node/mini_miner.cpp
  node/minisketchwrapper.cpp
  node/peerman_args.cpp
  node/psbt.cpp
  node/timeoffsets.cpp
  node/transaction.cpp
  node/txdownloadman_impl.cpp
  node/txorphanage.cpp
  node/txreconciliation.cpp
  node/utxo_snapshot.cpp
  node/warnings.cpp
  noui.cpp
  policy/ephemeral_policy.cpp
  policy/fees/block_policy_estimator.cpp
  policy/fees/estimator_args.cpp
  policy/fees/estimator_man.cpp
  policy/fees/mempool_estimator.cpp
  policy/packages.cpp
  policy/rbf.cpp
  policy/settings.cpp
  policy/truc_policy.cpp
  private_broadcast.cpp
  rest.cpp
  rpc/blockchain.cpp
  rpc/external_signer.cpp
  rpc/fees.cpp
  rpc/mempool.cpp
  rpc/mining.cpp
  rpc/net.cpp
  rpc/node.cpp
  rpc/output_script.cpp
  rpc/rawtransaction.cpp
  rpc/server.cpp
  rpc/server_util.cpp
  rpc/signmessage.cpp
  rpc/txoutproof.cpp
  script/sigcache.cpp
  signet.cpp
  torcontrol.cpp
  txdb.cpp
  txgraph.cpp
  txmempool.cpp
  txrequest.cpp
  validation.cpp
  validationinterface.cpp
  versionbits.cpp
  $<$<TARGET_EXISTS:bitx_wallet>:wallet/init.cpp>
  $<$<NOT:$<TARGET_EXISTS:bitx_wallet>>:dummywallet.cpp>
)
target_link_libraries(bitx_node
  PRIVATE
    core_interface
    bitxcore_common
    bitx_util
    $<TARGET_NAME_IF_EXISTS:bitx_zmq>
    leveldb
    minisketch
    univalue
    $<TARGET_NAME_IF_EXISTS:Boost::headers>
    $<TARGET_NAME_IF_EXISTS:USDT::headers>
)
if(WITH_EMBEDDED_ASMAP)
  target_compile_definitions(bitx_node PRIVATE ENABLE_EMBEDDED_ASMAP=1)
  include(TargetDataSources)
  target_raw_data_sources(bitx_node NAMESPACE node::data
    node/data/ip_asn.dat
  )
endif()

# BitX wrapper executable that can call other executables.
if(BUILD_BITX_BIN)
  add_executable(bitx
    bitx.cpp
    bitx-res.rc
  )
  add_windows_application_manifest(bitx)
  target_link_libraries(bitx core_interface bitxcore_common bitx_util)
  install_binary_component(bitx HAS_MANPAGE)
endif()

# BitX Core bitxd.
if(BUILD_DAEMON)
  add_executable(bitxd
    bitxd.cpp
    init/bitxd.cpp
  )
  add_windows_application_manifest(bitxd)
  target_link_libraries(bitxd
    core_interface
    bitx_node
    $<TARGET_NAME_IF_EXISTS:bitx_wallet>
  )
  install_binary_component(bitxd HAS_MANPAGE)
endif()
if(ENABLE_IPC AND BUILD_DAEMON)
  add_executable(bitx-node
    bitxd.cpp
    init/bitx-node.cpp
  )
  target_link_libraries(bitx-node
    core_interface
    bitx_node
    bitx_ipc
    $<TARGET_NAME_IF_EXISTS:bitx_wallet>
  )
  install_binary_component(bitx-node INTERNAL)
endif()


add_library(bitx_cli STATIC EXCLUDE_FROM_ALL
  compat/stdin.cpp
  rpc/client.cpp
)
target_link_libraries(bitx_cli
  PUBLIC
    core_interface
    univalue
)


# BitX Core RPC client
if(BUILD_CLI)
  add_executable(bitx-cli
    bitx-cli.cpp
    init/basic.cpp
  )
  add_windows_application_manifest(bitx-cli)
  target_link_libraries(bitx-cli
    core_interface
    bitx_cli
    bitxcore_common
    bitx_ipc
    bitx_util
  )
  install_binary_component(bitx-cli HAS_MANPAGE)
endif()


if(BUILD_TX)
  add_executable(bitxcore-tx
    bitx-tx.cpp
    bitx-tx-res.rc
  )
  add_windows_application_manifest(bitxcore-tx)
  target_link_libraries(bitxcore-tx
    core_interface
    bitxcore_common
    bitx_util
    univalue
  )
  install_binary_component(bitxcore-tx HAS_MANPAGE)
endif()


if(BUILD_UTIL)
  add_executable(bitxcore-util
    bitx-util.cpp
    bitx-util-res.rc
  )
  add_windows_application_manifest(bitxcore-util)
  target_link_libraries(bitxcore-util
    core_interface
    bitxcore_common
    bitx_util
    univalue
  )
  install_binary_component(bitxcore-util HAS_MANPAGE)
endif()


if(BUILD_GUI)
  add_subdirectory(qt)
endif()


if(BUILD_KERNEL_LIB)
  add_subdirectory(kernel)
  if (BUILD_KERNEL_TEST)
    add_subdirectory(test/kernel)
  endif()
  if(BUILD_UTIL_CHAINSTATE)
    add_executable(bitx-chainstate
      bitx-chainstate.cpp
    )
    add_windows_application_manifest(bitx-chainstate)
    target_link_libraries(bitx-chainstate
      PRIVATE
        core_interface
        bitxkernel
    )
    install_binary_component(bitx-chainstate INTERNAL)
  endif()
endif()


add_subdirectory(test/util)
if(BUILD_BENCH)
  add_subdirectory(bench)
endif()

if(BUILD_TESTS)
  add_subdirectory(test)
endif()

