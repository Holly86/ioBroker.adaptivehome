import { strict as assert } from 'node:assert';
import { CATALOG, LEARNING_MODES, OPERATING_MODES, REFERENCE_CASES } from './product';
describe('AP-01 product model', () => {
    it('describes three independent installations without mandatory optional integrations', () => {
        assert.equal(REFERENCE_CASES.length, 3);
        assert.deepEqual(REFERENCE_CASES[1].functions, ['equipment', 'lighting']);
        for (const reference of REFERENCE_CASES) for (const kind of reference.functions) {
            assert.ok(CATALOG.find(item => item.kind === kind)?.required.length);
        }
    });
    it('retains all autonomy and operating modes', () => {
        assert.deepEqual(LEARNING_MODES, ['classic', 'observe', 'suggest', 'bounded', 'full']);
        assert.ok(OPERATING_MODES.includes('continuous'));
        assert.ok(OPERATING_MODES.includes('maintenance'));
    });
});
