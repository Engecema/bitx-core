// Copyright (c) 2011-present The BitX Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

#ifndef BITX_QT_BITXADDRESSVALIDATOR_H
#define BITX_QT_BITXADDRESSVALIDATOR_H

#include <QValidator>

/** Base58 entry widget validator, checks for valid characters and
 * removes some whitespace.
 */
class BitXAddressEntryValidator : public QValidator
{
    Q_OBJECT

public:
    explicit BitXAddressEntryValidator(QObject *parent);

    State validate(QString &input, int &pos) const override;
};

/** BitX address widget validator, checks for a valid bitx address.
 */
class BitXAddressCheckValidator : public QValidator
{
    Q_OBJECT

public:
    explicit BitXAddressCheckValidator(QObject *parent);

    State validate(QString &input, int &pos) const override;
};

#endif // BITX_QT_BITXADDRESSVALIDATOR_H
