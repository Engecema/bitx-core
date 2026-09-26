// Copyright (c) 2015-present The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITX_COMMON_URL_H
#define BITX_COMMON_URL_H

#include <string>
#include <string_view>

/* Decode a URL.
 *
 * Notably this implementation does not decode a '+' to a ' '.
 */
std::string UrlDecode(std::string_view url_encoded);

/* Encode a URL. */
std::string UrlEncode(std::string_view str);

#endif // BITX_COMMON_URL_H
