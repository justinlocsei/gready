import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

const { assert } = chai;

export default assert;

/**
 * Return an object that can be used to track an expected series of assertions
 */
export function expectAssertions(count: number) {
  let assertions = 0;

  return {
    checkpoint: function(runAction?: () => void) {
      if (runAction) {
        runAction();
      }

      assertions++;
    },
    verify: function() {
      assert.equal(assertions, count, 'The expected number of assertions was not made');
    }
  };
}
