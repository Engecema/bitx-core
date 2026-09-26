// Copyright (c) The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#ifndef BITX_COMMON_LICENSE_INFO_H
#define BITX_COMMON_LICENSE_INFO_H

#include <string>

std::string CopyrightHolders(const std::string& strPrefix);

/** Returns licensing information (for -version) */
std::string LicenseInfo();

#endif // BITX_COMMON_LICENSE_INFO_H
