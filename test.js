// Dash Block Subsidy Calculator — Comprehensive Tests
// Runs in Node.js (node test.js) or browser (via test.html)
'use strict';

// === Core math functions (own copy, matching index.html exactly) ===

const COIN = 100_000_000;
const SUBSIDY_BASE_SATS = 5 * COIN; // 500000000
const HALVING_INTERVAL = 210240;

function getSubsidyForPeriod(period) {
    let nSubsidy = SUBSIDY_BASE_SATS;
    for (let i = 0; i < period; i++) {
        nSubsidy -= Math.trunc(nSubsidy / 14);
    }
    return nSubsidy;
}

function getBlockSubsidy(blockHeight) {
    if (blockHeight < 1) return null;
    const period = Math.floor((blockHeight - 1) / HALVING_INTERVAL);
    const nSubsidy = getSubsidyForPeriod(period);

    const treasury = Math.trunc(nSubsidy / 5);
    const blockReward = nSubsidy - treasury;
    const masternode = Math.trunc(blockReward * 3 / 4);
    const miner = blockReward - masternode;

    return { total: nSubsidy, treasury, masternode, miner, period };
}

// === Test framework ===

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name, detail) {
    if (condition) {
        passed++;
        results.push({ pass: true, name });
    } else {
        failed++;
        results.push({ pass: false, name, detail });
    }
}

function assertEqual(actual, expected, name) {
    assert(actual === expected, name, `expected ${expected}, got ${actual}`);
}

// === Tests ===

function runTests() {
    // -------------------------------------------------------
    // Period boundary tests (exact integer values)
    // -------------------------------------------------------
    const expectedSubsidies = [
        [0,  500000000],
        [1,  464285715],
        [2,  431122450],
        [3,  400327990],
        [4,  371733134],
        [5,  345180768],
        [6,  320524999],
        [7,  297630357],
        [8,  276371046],
        [9,  256630257],
        [10, 238299525],
        [11, 221278131],
        [12, 205472551],
        [13, 190795941],
        [14, 177167660],
    ];

    for (const [period, expected] of expectedSubsidies) {
        assertEqual(
            getSubsidyForPeriod(period), expected,
            `Period ${period} subsidy = ${expected} sat`
        );
    }

    // -------------------------------------------------------
    // Block height to period mapping
    // -------------------------------------------------------
    assertEqual(
        getBlockSubsidy(1).period, 0,
        'Block 1 → period 0 (prevHeight=0, loop does not fire)'
    );
    assertEqual(
        getBlockSubsidy(210240).period, 0,
        'Block 210240 → period 0 (prevHeight=210239, loop does not fire)'
    );
    assertEqual(
        getBlockSubsidy(210241).period, 1,
        'Block 210241 → period 1 (prevHeight=210240, loop fires once)'
    );
    assertEqual(
        getBlockSubsidy(420480).period, 1,
        'Block 420480 → period 1 (prevHeight=420479, loop fires once at i=210240)'
    );
    assertEqual(
        getBlockSubsidy(420481).period, 2,
        'Block 420481 → period 2 (prevHeight=420480, loop fires twice)'
    );

    // -------------------------------------------------------
    // Reward split tests (post-v20)
    // -------------------------------------------------------

    // Period 0 (subsidy = 500000000)
    const p0 = getBlockSubsidy(1);
    assertEqual(p0.total, 500000000, 'Period 0: total subsidy = 500000000');
    assertEqual(p0.treasury, 100000000, 'Period 0: treasury = trunc(500000000/5) = 100000000');
    assertEqual(p0.masternode, 300000000, 'Period 0: masternode = trunc(400000000*3/4) = 300000000');
    assertEqual(p0.miner, 100000000, 'Period 0: miner = 400000000 - 300000000 = 100000000');
    assertEqual(
        p0.treasury + p0.masternode + p0.miner, p0.total,
        'Period 0: reward components sum to total'
    );

    // Period 1 (subsidy = 464285715)
    const p1 = getBlockSubsidy(210241);
    assertEqual(p1.total, 464285715, 'Period 1: total subsidy = 464285715');
    assertEqual(p1.treasury, 92857143, 'Period 1: treasury = trunc(464285715/5) = 92857143');
    assertEqual(p1.masternode, 278571429, 'Period 1: masternode = trunc(371428572*3/4) = 278571429');
    assertEqual(p1.miner, 92857143, 'Period 1: miner = 371428572 - 278571429 = 92857143');
    assertEqual(
        p1.treasury + p1.masternode + p1.miner, p1.total,
        'Period 1: reward components sum to total'
    );

    // -------------------------------------------------------
    // Chain validation tests
    // The calculator uses a FIXED 5 DASH base subsidy (post-v20 rules).
    // Early Dash blocks had difficulty-based variable subsidies, so
    // pre-v20 values will diverge from historical actuals.
    // Post-v20 blocks where the fixed 5 DASH base applies should match.
    // -------------------------------------------------------

    // Block 2005632 (period 9): subsidy = 256630257 sat
    const chain1 = getBlockSubsidy(2005632);
    assertEqual(chain1.period, 9, 'Block 2005632 maps to period 9');
    assertEqual(chain1.total, 256630257, 'Block 2005632: subsidy = 256630257 sat');
    // coinbase = subsidy - treasury = 256630257 - trunc(256630257/5) = 256630257 - 51326051 = 205304206
    const coinbase1 = chain1.total - chain1.treasury;
    assertEqual(coinbase1, 205304206, 'Block 2005632: coinbase (subsidy - treasury) = 205304206 sat');

    // Block 2215872 (period 10): subsidy = 238299525 sat
    const chain2 = getBlockSubsidy(2215872);
    assertEqual(chain2.period, 10, 'Block 2215872 maps to period 10');
    assertEqual(chain2.total, 238299525, 'Block 2215872: subsidy = 238299525 sat');

    // -------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------

    // Block 1 (minimum valid height)
    const b1 = getBlockSubsidy(1);
    assert(b1 !== null, 'Block 1 returns a valid result');
    assertEqual(b1.total, 500000000, 'Block 1: subsidy = 500000000 (5 DASH)');

    // Block 0 and negative heights return null
    assertEqual(getBlockSubsidy(0), null, 'Block 0 returns null');
    assertEqual(getBlockSubsidy(-1), null, 'Block -1 returns null');

    // Very large block height (period 50+)
    const bigBlock = 50 * HALVING_INTERVAL + 1; // period 50
    const big = getBlockSubsidy(bigBlock);
    assert(big !== null, 'Period 50 returns a valid result');
    assert(big.total > 0, 'Period 50: subsidy is still positive');
    assert(big.period === 50, 'Period 50: period number is correct');
    assertEqual(
        big.treasury + big.masternode + big.miner, big.total,
        'Period 50: reward components sum to total'
    );

    // Subsidy eventually approaches 0
    const period200 = getSubsidyForPeriod(200);
    assert(period200 >= 0, 'Period 200: subsidy is non-negative');
    assert(period200 < 1000, 'Period 200: subsidy is negligible (< 1000 sat)');

    // Integer math precision — no floating point
    for (let p = 0; p < 30; p++) {
        const s = getSubsidyForPeriod(p);
        assertEqual(s, Math.floor(s), `Period ${p}: subsidy is an integer (no floating point)`);
    }

    // -------------------------------------------------------
    // Regression: nSubsidy -= trunc(nSubsidy/14)  vs
    //             nSubsidy = trunc(nSubsidy * 13 / 14)
    // These give DIFFERENT results due to integer division!
    // The first is correct (matches Dash Core).
    // -------------------------------------------------------
    function wrongMethod(period) {
        let nSubsidy = SUBSIDY_BASE_SATS;
        for (let i = 0; i < period; i++) {
            nSubsidy = Math.trunc(nSubsidy * 13 / 14);
        }
        return nSubsidy;
    }

    // They diverge starting at period 1
    assertEqual(
        getSubsidyForPeriod(0), wrongMethod(0),
        'Regression: period 0 both methods agree (no reduction yet)'
    );
    assert(
        getSubsidyForPeriod(1) !== wrongMethod(1),
        'Regression: period 1 methods diverge — correct=464285715, wrong=464285714',
    );
    assertEqual(
        getSubsidyForPeriod(1) - wrongMethod(1), 1,
        'Regression: difference at period 1 is exactly 1 sat'
    );

    // The divergence compounds over periods
    let totalDivergence = 0;
    for (let p = 0; p < 15; p++) {
        totalDivergence += getSubsidyForPeriod(p) - wrongMethod(p);
    }
    assert(
        totalDivergence > 1,
        `Regression: cumulative divergence over 15 periods = ${totalDivergence} sat (compounds)`
    );
}

// === Run and report ===

runTests();

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

if (isNode) {
    // Node.js output
    for (const r of results) {
        if (r.pass) {
            console.log(`  \x1b[32mPASS\x1b[0m  ${r.name}`);
        } else {
            console.log(`  \x1b[31mFAIL\x1b[0m  ${r.name}`);
            if (r.detail) console.log(`        ${r.detail}`);
        }
    }
    console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
} else if (typeof document !== 'undefined') {
    // Browser output — rendered by test.html
    window.__testResults = { passed, failed, results };
}
