# SPDX-License-Identifier: MIT
"""Make the project root importable so tests can reach ``orgs`` and ``demos``."""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
