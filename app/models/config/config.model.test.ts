import ConfigModel from './config.model';
import BaseTest from '../../helpers/tests/base';
import {Deserializer} from "../../utils/deserializer";
import {IEntityPriority} from "./config.model.interface";
import { DBService } from '../../services/dbService';
const {expect} = require('chai');


describe('config.model', () => {

  beforeEach((done) => {
    DBService.clearDB()
      .then(done);
  });
  
  after((done) => {
    DBService.clearDB().then(done);
  });

  describe('.getConfig', () => {
    it('should create new config document', (done) => {
      const _onSuccess = config => {
        expect(config).to.exist;

        done();
      };

      ConfigModel.getConfig()
        .then(_onSuccess)
        .catch(done);
    });

    it('should return existing one if available', (done) => {
      const _onSuccess = config => {
        expect(config).to.exist;
        expect(config.entityPriorities).to.exist;
        expect(config.entityPriorities.length).to.equal(1);

        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1"]);

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => ConfigModel.getConfig())
        })
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#setEntityPriorities', () => {
    it('should set entity priorities property', (done) => {
      const _onSuccess = config => {
        expect(config).to.exist;
        expect(config.entityPriorities).to.exist;
        expect(config.entityPriorities.length).to.equal(3);

        expect(config.entityPriorities[0].entityId).to.equal("entity1");
        expect(config.entityPriorities[0].priority).to.equal(3);

        expect(config.entityPriorities[2].entityId).to.equal("entity3");
        expect(config.entityPriorities[2].priority).to.equal(1);

        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3"]);

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              expect(saved).to.exist;

              return ConfigModel.getConfig();
            })
        })
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#setEntityPriorityConsideration', () => {
    it('should set entity priorities property', (done) => {
      const _onSuccess = config => {
        expect(config).to.exist;
        expect(config.entityPriorities).to.exist;
        expect(config.entityPriorities.length).to.equal(3);

        expect(config.entityPriorities[0].entityId).to.equal("entity1");
        expect(config.entityPriorities[0].priority).to.equal(3);
        expect(config.entityPriorities[0].consider).to.equal(false);

        expect(config.entityPriorities[1].consider).to.equal(true);
        expect(config.entityPriorities[2].consider).to.equal(true);
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3"]);

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              expect(saved).to.exist;

              return ConfigModel.getConfig()
                .then((config) => config.setEntityPriorityConsideration("entity1", false))
                .then((saved) => {
                  expect(saved).to.exist;
                  return ConfigModel.getConfig();
                })
            })
        })
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#getEntityPrioritiesSorted', () => {
    it('should get entity ids ordered by priority and consideration', (done) => {
      const _onSuccess = (entityIds: string[]) => {
        expect(entityIds).to.exist;
        expect(entityIds.length).to.equal(3);
        expect(entityIds[0]).to.equal("entity4");
        expect(entityIds[1]).to.equal("entity2");
        expect(entityIds[2]).to.equal("entity3");
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3", "entity4"]);

      entityPriorities[0].priority = 1; // entity1
      entityPriorities[0].consider = false; // entity1
      entityPriorities[3].priority = 4; // entity4

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              return ConfigModel.getConfig()
                .then((config) => config.getEntityPrioritiesSorted());
            })
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should get entity ids ordered by priority and ignore consideration', (done) => {
      const _onSuccess = (entityIds: string[]) => {
        expect(entityIds).to.exist;
        expect(entityIds.length).to.equal(4);
        expect(entityIds[0]).to.equal("entity4");
        expect(entityIds[1]).to.equal("entity2");
        expect(entityIds[2]).to.equal("entity3");
        expect(entityIds[3]).to.equal("entity1");
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3", "entity4"]);

      entityPriorities[0].priority = 1; // entity1
      entityPriorities[0].consider = false; // entity1
      entityPriorities[3].priority = 4; // entity4

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              return ConfigModel.getConfig()
                .then((config) => config.getEntityPrioritiesSorted(true));
            })
        })
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#addNewEntity', () => {
    it('should add new entity priority', (done) => {
      const _onSuccess = (entityIds: string[]) => {
        expect(entityIds).to.exist;
        expect(entityIds.length).to.equal(4);
        expect(entityIds[0]).to.equal("entity2");
        expect(entityIds[1]).to.equal("entity3");
        expect(entityIds[2]).to.equal("entity1");
        expect(entityIds[3]).to.equal("newEntity");
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3"]);

      entityPriorities[0].priority = 0; // entity1

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              return ConfigModel.getConfig()
                .then((config) => config.addNewEntity("newEntity"))
                .then((saved) => ConfigModel.getConfig())
                .then((config) => config.getEntityPrioritiesSorted())
            })
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should not add existing entityId again', (done) => {
      const _onSuccess = (entityIds: string[]) => {
        expect(entityIds).to.exist;
        expect(entityIds.length).to.equal(3);
        expect(entityIds[0]).to.equal("entity1");
        expect(entityIds[1]).to.equal("entity2");
        expect(entityIds[2]).to.equal("entity3");
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3"]);

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              return ConfigModel.getConfig()
                .then((config) => config.addNewEntity("entity1"))
                .catch((saved) => {
                  expect(saved).to.exist.and.equal("EntityId already exists");

                  return ConfigModel.getConfig()
                    .then((config) => config.getEntityPrioritiesSorted())
                })
            })
        })
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#considerExistingEntity', () => {
    it('should re-consider existing entity', (done) => {
      const _onSuccess = (entityIds: string[]) => {
        expect(entityIds).to.exist;
        expect(entityIds.length).to.equal(3);
        expect(entityIds[0]).to.equal("entity1");
        expect(entityIds[1]).to.equal("entity2");
        expect(entityIds[2]).to.equal("entity3");
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3"]);

      entityPriorities[0].consider = false; // entity1

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              return ConfigModel.getConfig()
                .then((config) => config.considerExistingEntity(entityPriorities[0].entityId))
                .then((saved) => ConfigModel.getConfig())
                .then((config) => config.getEntityPrioritiesSorted())
            })
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should ignore not existing entityId in priority list', (done) => {
      const _onSuccess = (entityIds: string[]) => {
        expect(entityIds).to.exist;
        expect(entityIds.length).to.equal(3);
        expect(entityIds[0]).to.equal("entity1");
        expect(entityIds[1]).to.equal("entity2");
        expect(entityIds[2]).to.equal("entity3");
        done();
      };

      let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3"]);

      ConfigModel.getConfig()
        .then((config) => {
          return config.setEntityPriorities(entityPriorities)
            .then((saved) => {
              return ConfigModel.getConfig()
                .then((config) => config.considerExistingEntity("NotExistsEntityId"))
                .then((saved) => ConfigModel.getConfig())
                .then((config) => config.getEntityPrioritiesSorted())
            })
        })
        .then(_onSuccess)
        .catch(done);
    });
  });
});
