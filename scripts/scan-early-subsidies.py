#!/usr/bin/env python3
"""
Scan early Dash blocks to compute exact cumulative emission for
the difficulty-dependent subsidy eras (before v20 hardcoded base).

Requires a fully-synced Dash Core node with RPC access.

Usage:
    python3 scripts/scan-early-subsidies.py [--cli /path/to/dash-cli] [--end BLOCK]

Output: JSON with cumulative emission at each algorithm boundary.

Algorithm boundaries (from validation.cpp GetBlockSubsidyHelper):
  - Blocks 1-5465:    1111/((diff+1)^2),        range 1-500 DASH
  - Blocks 5466-17000: 11111/(((diff+51)/6)^2),  range 25-500 DASH
  - Blocks 17001+:    2222222/(((diff+2600)/9)^2), range 5-25 DASH
  - Post-v20 (1987776+): hardcoded 5 DASH

Note: boundaries are +1 from source code thresholds because the code
uses nPrevHeight (blockHeight - 1) for its conditions.
"""

import argparse
import json
import subprocess
import sys
import time


def get_coinbase_value(cli_path, height):
    """Get total coinbase output value for a block."""
    blockhash = subprocess.check_output(
        [cli_path, "getblockhash", str(height)]
    ).decode().strip()
    block = json.loads(subprocess.check_output(
        [cli_path, "getblock", blockhash, "2"]
    ))
    return sum(o["value"] for o in block["tx"][0]["vout"])


def main():
    parser = argparse.ArgumentParser(description="Scan early Dash block subsidies")
    parser.add_argument("--cli", default="dash-cli", help="Path to dash-cli")
    parser.add_argument("--end", type=int, default=210239,
                        help="Last block to scan (default: 210239, end of period 0)")
    parser.add_argument("--output", default=None,
                        help="Output JSON file (default: stdout)")
    args = parser.parse_args()

    # Algorithm boundary blocks
    boundaries = {
        5465: "End of era 0a (1111/((diff+1)^2), range 1-500 DASH)",
        17000: "End of era 0b (11111/(((diff+51)/6)^2), range 25-500 DASH)",
        args.end: f"End of era 0c / period 0 (2222222/(((diff+2600)/9)^2), range 5-25 DASH)",
    }

    results = {}
    cumulative = 0.0
    start = time.time()

    print(f"Scanning blocks 1 to {args.end}...", file=sys.stderr)

    for height in range(1, args.end + 1):
        cb_value = get_coinbase_value(args.cli, height)
        cumulative += cb_value

        if height in boundaries:
            results[str(height)] = {
                "description": boundaries[height],
                "block_subsidy_dash": cb_value,
                "cumulative_dash": round(cumulative, 8),
                "elapsed_minutes": round((time.time() - start) / 60, 1),
            }
            print(
                f"  Block {height}: subsidy={cb_value:.8f} DASH, "
                f"cumulative={cumulative:.8f} DASH "
                f"({(time.time() - start) / 60:.1f}min)",
                file=sys.stderr,
            )

        if height % 10000 == 0:
            print(
                f"  Progress: {height}/{args.end} "
                f"({(time.time() - start) / 60:.1f}min)",
                file=sys.stderr,
            )

    elapsed = (time.time() - start) / 60
    print(f"\nDone in {elapsed:.1f} minutes", file=sys.stderr)

    output = json.dumps(results, indent=2)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output + "\n")
        print(f"Results written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
