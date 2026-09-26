# Copyright (c) 2023-present The BitX Core developers
# Distributed under the MIT software license, see the accompanying
# file COPYING or https://opensource.org/license/mit/.

target_link_libraries(test_bitx bitx_ipc_test bitx_ipc)

add_boost_test(${CMAKE_CURRENT_SOURCE_DIR}/ipc_tests.cpp)
