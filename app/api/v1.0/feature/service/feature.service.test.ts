import { expect } from 'chai';
import { DBService } from "../../../../services/dbService";
import FeatureService from "./feature.service";

describe("Feature Flag Service v1.0", () => {
  beforeEach((done) => {
    DBService.clearDB().then(done);
  });

  it('should return list of features', (done) => {
    const featureName = 'featureTest'
    FeatureService.create(featureName)
      .then(() => FeatureService.getList())
      .then(res => {
        expect(res).to.be.instanceof(Array);
        expect(res.length).to.equal(1)
        const feature = res[0]
        expect(feature.name).to.equal(featureName)
        expect(feature.isOn).to.equal(false)
        done()
      })
      .catch(done)
  })

  it('should update feature from isOn=false to true', (done) => {
    const featureName = 'featureTest'
    FeatureService.create(featureName)
      .then((feature) => FeatureService.updateFeatureStatus(feature.id, true))
      .then(feature => {
        expect(feature).to.exist;
        expect(feature.name).to.equal(featureName)
        expect(feature.isOn).to.equal(true)
        done()
      })
      .catch(done)
  })

  it('should return feature by id', (done) => {
    const featureName = 'featureTest'
    FeatureService.create(featureName)
      .then((feature) => FeatureService.getFeatureById(feature.id))
      .then(feature => {
        expect(feature).to.exist
        expect(feature.name).to.equal(featureName)
        expect(feature.isOn).to.equal(false)
        done()
      })
      .catch(done)
  })

  it('should return feature by name', (done) => {
    const featureName = 'featureTest'
    FeatureService.create(featureName)
      .then((feature) => FeatureService.getFeatureByName(featureName))
      .then(feature => {
        expect(feature).to.exist
        expect(feature.name).to.equal(featureName)
        expect(feature.isOn).to.equal(false)
        done()
      })
      .catch(done)
  })

  it('should reject if feature not found', (done) => {
    const featureName = 'featureTest'
    FeatureService.getFeatureByName(featureName)
      .catch(error => {
        expect(error).to.exist
        done()
      })
  })
})