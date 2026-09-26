#!/usr/bin/env python3
# Copyright (c) The BitX Core developers
# Distributed under the MIT software license, see the accompanying
# file COPYING or http://www.opensource.org/licenses/mit-license.php.
"""Test that bitx-gui starts up and can be stopped via RPC."""

import platform

from test_framework.test_framework import (
    BitXTestFramework,
    SkipTest,
)


class GuiTest(BitXTestFramework):
    def set_test_params(self):
        self.num_nodes = 1
        self.extra_args = [["-server"]]

    def skip_test_if_missing_module(self):
        self.skip_if_no_gui()
        # On Windows, bitx.exe exits immediately when launching bitx-gui.exe,
        # causing the test framework's process monitor to see a premature node exit.
        # This issue is likely fixable.
        if platform.system() == "Windows":
            raise SkipTest("bitx-gui test not supported on Windows")

    def setup_nodes(self):
        self.extra_init = [{"use_gui": True}]
        super().setup_nodes()

    def run_test(self):
        self.log.info("Test that bitx-gui starts up and can be stopped via RPC")
        self.stop_node(0)


if __name__ == "__main__":
    GuiTest(__file__).main()
