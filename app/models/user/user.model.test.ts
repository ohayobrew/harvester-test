import UserModel from './user.model';
import * as ModelFactory from '../../helpers/tests/modelFactory'
import BaseTest from '../../helpers/tests/base';
import { DBService } from '../../services/dbService';
var expect = require('chai').expect;


describe('user.model', () => {

  beforeEach((done) => {
    DBService.clearDB()
      .then(done);
  });
  
  after((done) => {
    DBService.clearDB().then(done);
  });

  describe('.createUser', () => {
    it('should create user', (done) => {
      var _onSuccess = user => {
        expect(user).to.be.exist;
        expect(user.email).to.equal(ModelFactory.userWithoutTags.email);
        expect(user.vatboxUserId).to.equal(ModelFactory.userWithoutTags.vatboxUserId);
        expect(user).to.have.property('id');

        done();
      };

      UserModel
        .createUser(ModelFactory.userWithoutTags)
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('.getByVatboxUserId', () => {
    beforeEach((done) => {
      UserModel.createUser(ModelFactory.userWithoutTags)
        .then(() => done())
        .catch(() => done());
    });

    it('should get existing user', (done) => {
      var _onSuccess = user => {
        expect(user).to.be.exist;

        done();
      };

      UserModel
        .getByVatboxUserId(ModelFactory.userWithoutTags.vatboxUserId)
        .then(_onSuccess)
        .catch(done);
    });

    it('should not get user when getting non existing vatboxUserId', (done) => {
      var _onSuccess = user => {
        expect(user).not.to.be.exist;

        done();
      };

      UserModel
        .getByVatboxUserId("foo")
        .then(_onSuccess)
        .catch(done);
    });
  });
});
