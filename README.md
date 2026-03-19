# Dash Block Subsidy Calculator

A single-page static site that calculates Dash block subsidies, displays the full emission schedule, and visualizes the supply curve.

**[View Live Site](https://thepastaclaw.github.io/dash-subsidy-calculator/)**

## Features

- **Block Subsidy Calculator** — Enter any block height to see the exact subsidy with miner/masternode/treasury breakdown
- **Network Estimate** — Shows current estimated block height, subsidy, and circulating supply
- **Subsidy Schedule** — Complete table of all reduction periods with block ranges, dates, and cumulative emission
- **Emission Curve** — Interactive chart showing block subsidy decay and cumulative supply over time

## How the Math Works

Dash's block subsidy uses integer arithmetic (satoshis) with a ~7.14% annual reduction:

```
nSubsidy = 500000000  (5 DASH in satoshis)

for each 210,240-block period:
    nSubsidy -= floor(nSubsidy / 14)
```

Each period retains 13/14 of the previous subsidy. Post-v20 allocation:
- **20%** Miners
- **60%** Masternodes (62.5% Core chain, 37.5% Platform credit pool)
- **20%** Treasury (governance proposals)

## Key Constants

| Constant | Value |
|----------|-------|
| Base subsidy | 5 DASH (500,000,000 sat) |
| Halving interval | 210,240 blocks (~1 year) |
| Reduction rate | 1/14 per period (~7.14%) |
| Genesis block | Jan 18, 2014 |
| Avg block time | 2.6 minutes |

## Deployment

Pure HTML/CSS/JS — no build step required. Just serve `index.html`:

```bash
# Local preview
open index.html

# Or with a local server
python3 -m http.server 8000
```

For GitHub Pages, push to `main` and enable Pages in repository settings.

## References

- [Dash Core source (validation.cpp)](https://github.com/dashpay/dash/blob/master/src/validation.cpp) — `GetBlockSubsidyHelper`
- [Dash Documentation](https://docs.dash.org)
