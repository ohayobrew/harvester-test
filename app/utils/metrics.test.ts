import metrics from "./metrics";
import {expect} from 'chai';

describe('Metrics', () => {
  it("should successfully return client instance", () => {
    expect(metrics).to.exist;
    expect(metrics.getExpressMiddleware()).to.exist;
  })
});
