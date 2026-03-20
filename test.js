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

    // Treasury (superblock budget)
    let treasury = 0;
    const isV20 = blockHeight >= 1987776;
    if (blockHeight > 328009) {
        treasury = Math.trunc(nSubsidy / (isV20 ? 5 : 10));
    }

    const blockReward = nSubsidy - treasury;

    // Masternode payment (matching Core's GetMasternodePayment)
    let masternode = 0;
    if (blockHeight > 100000) {
        // Step schedule (always computed for blocks > 100000)
        let ret = Math.trunc(blockReward / 5); // 20%
        if (blockHeight > 158000) ret += Math.trunc(blockReward / 20); // 25%
        if (blockHeight > 175280) ret += Math.trunc(blockReward / 20); // 30%
        if (blockHeight > 192560) ret += Math.trunc(blockReward / 20); // 35%
        if (blockHeight > 209840) ret += Math.trunc(blockReward / 40); // 37.5%
        if (blockHeight > 227120) ret += Math.trunc(blockReward / 40); // 40%
        if (blockHeight > 244400) ret += Math.trunc(blockReward / 40); // 42.5%
        if (blockHeight > 261680) ret += Math.trunc(blockReward / 40); // 45%
        if (blockHeight > 278960) ret += Math.trunc(blockReward / 40); // 47.5%
        if (blockHeight > 313520) ret += Math.trunc(blockReward / 40); // 50%
        masternode = ret;

        // BRR reallocation (Core: nReallocActivationHeight = 1374912)
        const BRR_HEIGHT = 1374912;
        const SUPERBLOCK_CYCLE = 16616;
        const nReallocStart = BRR_HEIGHT - (BRR_HEIGHT % SUPERBLOCK_CYCLE) + SUPERBLOCK_CYCLE;

        if (blockHeight >= nReallocStart) {
            if (isV20) {
                // v20: MN = 75% of blockReward (60% of subsidy)
                masternode = Math.trunc(blockReward * 3 / 4);
            } else {
                // 19 discrete steps from 51.3% to 60% (per mille of blockReward)
                const vecPeriods = [513, 526, 533, 540, 546, 552, 557, 562, 567, 572, 577, 582, 585, 588, 591, 594, 597, 599, 600];
                const nReallocCycle = SUPERBLOCK_CYCLE * 3;
                const nCurrentPeriod = Math.min(Math.floor((blockHeight - nReallocStart) / nReallocCycle), vecPeriods.length - 1);
                masternode = Math.trunc(blockReward * vecPeriods[nCurrentPeriod] / 1000);
            }
        }
    }
    // else: blocks 1-100000, no masternode payments

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
    // Era-specific reward split tests
    // -------------------------------------------------------

    // Pre-Masternode Era: Block 50 — 100% to miners, no MN, no treasury
    const b50 = getBlockSubsidy(50);
    assertEqual(b50.total, 500000000, 'Block 50: total subsidy = 500000000');
    assertEqual(b50.treasury, 0, 'Block 50: no treasury (pre-328008)');
    assertEqual(b50.masternode, 0, 'Block 50: no masternode (pre-100000)');
    assertEqual(b50.miner, 500000000, 'Block 50: miner gets full subsidy');

    // Early Masternode Era: Block 150000 — MN=20%, no treasury
    const b150k = getBlockSubsidy(150000);
    assertEqual(b150k.total, 500000000, 'Block 150000: total subsidy = 500000000');
    assertEqual(b150k.treasury, 0, 'Block 150000: no treasury (pre-328008)');
    assertEqual(b150k.masternode, Math.trunc(500000000 / 5), 'Block 150000: MN = 20% of blockReward');
    assertEqual(b150k.miner, 500000000 - Math.trunc(500000000 / 5), 'Block 150000: miner = 80%');
    assertEqual(
        b150k.treasury + b150k.masternode + b150k.miner, b150k.total,
        'Block 150000: reward components sum to total'
    );

    // Early Masternode Era: Block 200000 — MN=35% of blockReward, no treasury
    const b200k = getBlockSubsidy(200000);
    assertEqual(b200k.treasury, 0, 'Block 200000: no treasury');
    // 20% + 5% + 5% + 5% = 35%
    const mn200k = Math.trunc(500000000 / 5) + Math.trunc(500000000 / 20) + Math.trunc(500000000 / 20) + Math.trunc(500000000 / 20);
    assertEqual(b200k.masternode, mn200k, 'Block 200000: MN = 35% of blockReward');

    // Budget Era: Block 400000 — treasury=10%, MN=50% of blockReward
    const b400k = getBlockSubsidy(400000);
    assertEqual(b400k.total, 464285715, 'Block 400000: period 1 subsidy');
    assertEqual(b400k.treasury, Math.trunc(464285715 / 10), 'Block 400000: treasury = 10%');
    const br400k = 464285715 - Math.trunc(464285715 / 10); // blockReward
    // All MN steps active through > 313520
    let mn400k = Math.trunc(br400k / 5);
    mn400k += Math.trunc(br400k / 20); // >158000
    mn400k += Math.trunc(br400k / 20); // >175280
    mn400k += Math.trunc(br400k / 20); // >192560
    mn400k += Math.trunc(br400k / 40); // >209840
    mn400k += Math.trunc(br400k / 40); // >227120
    mn400k += Math.trunc(br400k / 40); // >244400
    mn400k += Math.trunc(br400k / 40); // >261680
    mn400k += Math.trunc(br400k / 40); // >278960
    mn400k += Math.trunc(br400k / 40); // >313520
    assertEqual(b400k.masternode, mn400k, 'Block 400000: MN = 50% of blockReward');
    assertEqual(
        b400k.treasury + b400k.masternode + b400k.miner, b400k.total,
        'Block 400000: reward components sum to total'
    );

    // BRR Transition: Block 1500000 — treasury=10%, MN via vecPeriods
    // nReallocStart=1379128, nReallocCycle=49848, period=floor((1500000-1379128)/49848)=2, vecPeriods[2]=533
    const b1500k = getBlockSubsidy(1500000);
    assertEqual(b1500k.treasury, Math.trunc(b1500k.total / 10), 'Block 1500000: treasury = 10%');
    const br1500k = b1500k.total - b1500k.treasury;
    assertEqual(b1500k.masternode, Math.trunc(br1500k * 533 / 1000), 'Block 1500000: MN = 53.3% of blockReward (vecPeriods[2])');
    assertEqual(
        b1500k.treasury + b1500k.masternode + b1500k.miner, b1500k.total,
        'Block 1500000: reward components sum to total'
    );

    // Era boundary: block 100000 is pre-MN, 100001 has MN payments
    const bBoundaryMN = getBlockSubsidy(100000);
    assertEqual(bBoundaryMN.masternode, 0, 'Block 100000: no masternode (boundary)');
    const bBoundaryMN2 = getBlockSubsidy(100001);
    assert(bBoundaryMN2.masternode > 0, 'Block 100001: masternode payments begin');

    // Era boundary: block 328009 has no treasury, 328010 has treasury
    // Core: nPrevHeight > nBudgetPaymentsStartBlock (328008), nPrevHeight = blockHeight - 1
    const bBoundaryT = getBlockSubsidy(328009);
    assertEqual(bBoundaryT.treasury, 0, 'Block 328009: no treasury (boundary)');
    const bBoundaryT2 = getBlockSubsidy(328010);
    assert(bBoundaryT2.treasury > 0, 'Block 328010: treasury begins');
    assertEqual(bBoundaryT2.treasury, Math.trunc(bBoundaryT2.total / 10), 'Block 328010: treasury = 10%');

    // v20 Era: Block 2000000 — treasury=20%, MN=60% of subsidy
    const b2m = getBlockSubsidy(2000000);
    assertEqual(b2m.total, 256630257, 'Block 2000000: period 9 subsidy');
    assertEqual(b2m.treasury, Math.trunc(256630257 / 5), 'Block 2000000: treasury = 20%');
    const br2m = 256630257 - Math.trunc(256630257 / 5);
    assertEqual(b2m.masternode, Math.trunc(br2m * 3 / 4), 'Block 2000000: MN = 75% of blockReward (60% of subsidy)');
    assertEqual(
        b2m.treasury + b2m.masternode + b2m.miner, b2m.total,
        'Block 2000000: reward components sum to total'
    );

    // -------------------------------------------------------
    // Chain validation tests (post-v20 blocks)
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

    // Block 1 (minimum valid height, pre-masternode era)
    const b1 = getBlockSubsidy(1);
    assert(b1 !== null, 'Block 1 returns a valid result');
    assertEqual(b1.total, 500000000, 'Block 1: subsidy = 500000000 (5 DASH)');
    assertEqual(b1.miner, 500000000, 'Block 1: miner gets full subsidy (pre-masternode)');

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

    // -------------------------------------------------------
    // V20 boundary tests
    // -------------------------------------------------------

    // Block 1987776: first v20 block — treasury=20%, MN=75% of blockReward
    const bV20 = getBlockSubsidy(1987776);
    assertEqual(bV20.treasury, Math.trunc(bV20.total / 5), 'Block 1987776: treasury = 20% (v20 activation)');
    const brV20 = bV20.total - bV20.treasury;
    assertEqual(bV20.masternode, Math.trunc(brV20 * 3 / 4), 'Block 1987776: MN = 75% of blockReward (v20)');
    assertEqual(
        bV20.treasury + bV20.masternode + bV20.miner, bV20.total,
        'Block 1987776: reward components sum to total'
    );

    // Block 1987775: last pre-v20 block — treasury=10%, MN via vecPeriods
    const bPreV20 = getBlockSubsidy(1987775);
    assertEqual(bPreV20.treasury, Math.trunc(bPreV20.total / 10), 'Block 1987775: treasury = 10% (pre-v20)');
    assert(bPreV20.treasury !== Math.trunc(bPreV20.total / 5), 'Block 1987775: treasury is NOT 20%');

    // -------------------------------------------------------
    // BRR gap tests (between BRRHeight and nReallocStart)
    // -------------------------------------------------------

    // nReallocStart = 1374912 - (1374912 % 16616) + 16616 = 1379128
    // Blocks in [1374912, 1379127] use the step schedule (50% for blocks > 313520)
    const bBRRGap = getBlockSubsidy(1375000);
    const brBRRGap = bBRRGap.total - bBRRGap.treasury;
    let mnBRRGap = Math.trunc(brBRRGap / 5);
    mnBRRGap += Math.trunc(brBRRGap / 20);
    mnBRRGap += Math.trunc(brBRRGap / 20);
    mnBRRGap += Math.trunc(brBRRGap / 20);
    mnBRRGap += Math.trunc(brBRRGap / 40);
    mnBRRGap += Math.trunc(brBRRGap / 40);
    mnBRRGap += Math.trunc(brBRRGap / 40);
    mnBRRGap += Math.trunc(brBRRGap / 40);
    mnBRRGap += Math.trunc(brBRRGap / 40);
    mnBRRGap += Math.trunc(brBRRGap / 40);
    assertEqual(bBRRGap.masternode, mnBRRGap, 'Block 1375000: BRR gap uses step schedule (50%)');

    // -------------------------------------------------------
    // vecPeriods step tests
    // -------------------------------------------------------

    // nReallocStart = 1379128, nReallocCycle = 49848
    // Period 0: blocks [1379128, 1428975], vecPeriods[0] = 513
    const bVec0 = getBlockSubsidy(1379128);
    const brVec0 = bVec0.total - bVec0.treasury;
    assertEqual(bVec0.masternode, Math.trunc(brVec0 * 513 / 1000), 'Block 1379128: vecPeriods[0] = 51.3%');

    // Period 1: blocks [1428976, 1478823], vecPeriods[1] = 526
    const bVec1 = getBlockSubsidy(1428976);
    const brVec1 = bVec1.total - bVec1.treasury;
    assertEqual(bVec1.masternode, Math.trunc(brVec1 * 526 / 1000), 'Block 1428976: vecPeriods[1] = 52.6%');

    // Period 18 (last): vecPeriods[18] = 600 (60%)
    // First block of period 18: 1379128 + 18 * 49848 = 1379128 + 897264 = 2276392
    // But this is past v20 (1987776), so v20 takes over. Test the last pre-v20 vecPeriods block instead.
    // Period at block 1987775: floor((1987775 - 1379128) / 49848) = floor(608647/49848) = 12
    // vecPeriods[12] = 585
    const bVecLast = getBlockSubsidy(1987775);
    const brVecLast = bVecLast.total - bVecLast.treasury;
    assertEqual(bVecLast.masternode, Math.trunc(brVecLast * 585 / 1000), 'Block 1987775: vecPeriods[12] = 58.5% (last pre-v20)');
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
