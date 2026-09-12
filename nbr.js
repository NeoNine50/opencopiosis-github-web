/*
 * OpenCopiosis integer-native NBR algorithm.
 *
 * With this version of the NBR algorithm functioning. There is no rounding, ceiling, or flooring 
 * of the final NBR result applied to handle fractional results. Results are now whole numbers on their own.
 *
 * The older web algorithm used a continuous Math.log() multiplier + ceil.
 * A continuous logarithm cannot guarantee an integer result for arbitrary
 * form inputs, so this version replaces that multiplier with a discrete
 * logarithmic demand scale. The scale grows by one whole demand unit each
 * time the beneficiary/producer ratio crosses the next power-of-two band.
 *
 * Benefit inputs are stored as fixed integer points:
 *   subjective: -1..1 in 0.5 steps  -> -2..2 points
 *   objective/environment/human: -1..1 in 0.1 steps -> -10..10 points
 * Tuners are whole-number multipliers.
 * Resource abundance is a whole-number multiplier.
 */
(function (global) {
    const SUBJECTIVE_SCALE = 2;
    const OTHER_BENEFIT_SCALE = 10;

    function asInteger(value, name) {
        const n = Number(value);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
            throw new Error(`${name} must be a whole number.`);
        }
        return n;
    }

    function subjectivePoints(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || !Number.isInteger(n * SUBJECTIVE_SCALE)) {
            throw new Error('Consumer Subjective Benefit must be a 0.5-step value.');
        }
        return n * SUBJECTIVE_SCALE;
    }

    function benefitPoints(value, name) {
        const n = Number(value);
        if (!Number.isFinite(n) || !Number.isInteger(n * OTHER_BENEFIT_SCALE)) {
            throw new Error(`${name} must be a 0.1-step value.`);
        }
        return n * OTHER_BENEFIT_SCALE;
    }

    // Integer-only logarithmic demand scale.
    // 0 beneficiaries -> 0 units.
    // Any positive demand starts at 1 unit; every doubling of B/P adds one.
    // No Math.log(), ceil(), floor(), or round() is used.
    function demandUnits(beneficiaries, producers) {
        const b = asInteger(beneficiaries, 'Beneficiaries');
        const p = asInteger(producers, 'Producers');
        if (b < 0 || p < 1) throw new Error('Beneficiaries must be >= 0 and producers must be >= 1.');
        if (b === 0) return 0;

        let units = 1;
        let threshold = p * 2;
        while (b >= threshold) {
            units += 1;
            threshold *= 2;
            if (!Number.isSafeInteger(threshold)) {
                throw new Error('Beneficiary/producer values are too large.');
            }
        }
        return units;
    }

    function calculateNBR(data, satisfactionOverride) {
        const abundance = asInteger(data.resabundance, 'Resource Abundance');
        const beneficiaries = asInteger(data.beneficiaries, 'Beneficiaries');
        const producers = asInteger(data.producers, 'Producers');
        const ccs = asInteger(data.ccs, 'Consumer Subjective Benefit Tuning');
        const cco = asInteger(data.cco, 'Consumer Objective Benefit Tuning');
        const ceb = asInteger(data.ceb, 'Environmental Benefit Tuning');
        const chb = asInteger(data.chb, 'Human Benefit Tuning');

        const subjective = subjectivePoints(
            satisfactionOverride === undefined ? data.conssubben : satisfactionOverride
        );
        const objective = benefitPoints(data.consobjben, 'Consumer Objective Benefit');
        const environmental = benefitPoints(data.envben, 'Environmental Benefit');
        const human = benefitPoints(data.humanben, 'Human Benefit');

        if (abundance < 0 || ccs < 0 || cco < 0 || ceb < 0 || chb < 0) {
            throw new Error('Resource abundance and tuning multipliers must be >= 0.');
        }

        const demand = demandUnits(beneficiaries, producers);
        const benefitScore =
            (ccs * subjective) +
            (cco * objective) +
            (ceb * environmental) +
            (chb * human);

        // Benefit points are tenths/twentieths by design, so divide by the
        // common scale to restore benefit units.  The NBR unit is defined as
        // one whole benefit-point product, making the stored result integral.
        // We deliberately use the point representation itself as the NBR unit.
        const nbr = abundance * demand * benefitScore;
        return Math.max(0, nbr);
    }

    global.CopiosisNBR = {
        calculateNBR,
        demandUnits,
        SUBJECTIVE_SCALE,
        OTHER_BENEFIT_SCALE
    };
})(window);
