import {ImaginaryService} from './imaginaryService';
const nock = require('nock');
const { expect } = require('chai');

//TODO: move to another config structure
import * as path from 'path';
import {ICropArea} from '../models/image/image.model.interface';
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

let IMAGINARY_HOST = `${Config.imaginaryApi.host}${Config.imaginaryApi.apiPath}`;

const IMAGE_1_INFO = {
	id: "1",
	cloudinaryId: "1",
	mimeType: "image/jpeg"
};

const PDF_1_INFO = {
	id: "2",
	cloudinaryId: "2",
	mimeType: "application/pdf"
};

const PDF_1_CONVERTED_INFO = {
	id: "22",
	cloudinaryId: "22",
	mimeType: "image/jpeg"
};

const CROP_AREA_1: ICropArea = {
	x: Number(10),
	y: Number(10),
	width: Number(90),
	height: Number(90),
	createdAt: new Date()
};


const assertPendingMocks = (mockScope, done: MochaDone) => {
	if (!mockScope.isDone()) {
		console.error('pending mocks: %j', mockScope.pendingMocks());
		done(new Error());
	} else
		done();
};

const mockScope = nock(IMAGINARY_HOST);

describe('Imaginary API', () => {
	
	after((done) => {
		assertPendingMocks(mockScope, done);
	});

	describe('.getInfo', () => {
    it('promise should return image info successfully', (done) => {
			mockScope
				.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
        .matchHeader("CallingServer", Config.serviceName)
				.reply(200, IMAGE_1_INFO);

			ImaginaryService.getInfo(IMAGE_1_INFO.id)
        .then((returnVal) => {
          expect(returnVal.id).to.equal(IMAGE_1_INFO.id);
          expect(returnVal.cloudinaryId).to.equal(IMAGE_1_INFO.cloudinaryId);
          expect(returnVal.mimeType).to.equal(IMAGE_1_INFO.mimeType);
          done();
        })
				.catch(done);
    });

    it('promise should fail if image not found', (done) => {
			mockScope
				.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
				.reply(404);

			ImaginaryService.getInfo(IMAGE_1_INFO.id)
				.then((returnVal) => {
					//we should not get here
					expect(true).to.equal(false);
					done();
				})
				.catch((err) => {
					expect(err.message).to.contains("Image not found on Imaginary service");
					done();
				});
    });

    it('promise should fail if request exceeding allowed response time', (done) => {
      let originalTimeoutValue = Config.imaginaryApi.requestTimeoutMs;
      Config.imaginaryApi.requestTimeoutMs = 100;

      mockScope
				.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
        .delayConnection(1000)
        .reply(200);

			ImaginaryService.getInfo(IMAGE_1_INFO.id)
				.catch((err) => {
					expect(err.message).to.match(/Imaginary.*timeout/);

          Config.imaginaryApi.requestTimeoutMs = originalTimeoutValue; // restore value
					done();
				});
    });

    it('promise should fail when other non-error status returns', (done) => {
			mockScope
				.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
				.reply(204);

			ImaginaryService.getInfo(IMAGE_1_INFO.id)
				.then((returnVal) => {
					//we should not get here
					expect(true).to.equal(false);
					done();
				})
				.catch((err) => {
					expect(err).to.be.exist;
					expect(err.message).to.be.exist;

					done();
				});
    });
  });

	describe('.getInfoConverted', () => {
		describe('for non-PDF image', () => {
			it('promise should return image info successfully', (done) => {
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(200, IMAGE_1_INFO);

				ImaginaryService.getInfoConverted(IMAGE_1_INFO.id)
					.then((returnVal) => {
						expect(returnVal.id).to.equal(IMAGE_1_INFO.id);
						expect(returnVal.cloudinaryId).to.equal(IMAGE_1_INFO.cloudinaryId);
						expect(returnVal.mimeType).to.equal(IMAGE_1_INFO.mimeType);
						done();
					})
					.catch(done);
			});

			it('promise should fail if image not found', (done) => {
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(404);

				ImaginaryService.getInfoConverted(IMAGE_1_INFO.id)
					.then((returnVal) => {
						//we should not get here
						expect(true).to.equal(false);
						done();
					})
					.catch((err) => {
						expect(err.message).to.contains("Image not found on Imaginary service");
						done();
					});
			});

			it('promise should fail when other non-error status returns', (done) => {
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(204);

				ImaginaryService.getInfoConverted(IMAGE_1_INFO.id)
					.then((returnVal) => {
						//we should not get here
						expect(true).to.equal(false);
						done();
					})
					.catch((err) => {
						expect(err).to.be.exist;
						expect(err.message).to.be.exist;

						done();
					});
			});
		});

		describe('for PDF', () => {
			let manipulations = [ {
        "action" : "pdftoimage",
        toMime: Config.imaginaryApi.defaultImageFormat
      } ];

			it('promise should return PDF image info successfully when 200 returns', (done) => {
				//mock the first GET /:id/info call
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(200, PDF_1_INFO);

				//mock the follows POST :/id manipulation call
				mockScope
					.post(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}`, manipulations)
					.reply(200, PDF_1_CONVERTED_INFO);

				ImaginaryService.getInfoConverted(PDF_1_INFO.id)
					.then((returnVal) => {
						expect(returnVal.id).to.equal(PDF_1_CONVERTED_INFO.id);
						expect(returnVal.cloudinaryId).to.equal(PDF_1_CONVERTED_INFO.cloudinaryId);
						expect(returnVal.mimeType).to.equal(PDF_1_CONVERTED_INFO.mimeType);
						done();
					})
					.catch(done);
			});

			it('promise should return PDF image info successfully when 201 returns', (done) => {
				//mock the first GET /:id/info call
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(200, PDF_1_INFO);

				//mock the follows POST :/id manipulation call
				mockScope
					.post(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}`, manipulations)
					.reply(201, PDF_1_CONVERTED_INFO);

				ImaginaryService.getInfoConverted(PDF_1_INFO.id)
					.then((returnVal) => {
						expect(returnVal.id).to.equal(PDF_1_CONVERTED_INFO.id);
						expect(returnVal.cloudinaryId).to.equal(PDF_1_CONVERTED_INFO.cloudinaryId);
						expect(returnVal.mimeType).to.equal(PDF_1_CONVERTED_INFO.mimeType);
						done();
					})
					.catch(done);
			});

			it('promise should fail if PDF image not found', (done) => {
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(404);

				ImaginaryService.getInfoConverted(PDF_1_INFO.id)
					.then((returnVal) => {
						//we should not get here
						expect(true).to.equal(false);
						done();
					})
					.catch((err) => {
						expect(err.message).to.contains("Image not found on Imaginary service");
						done();
					});
			});

			it('promise should fail if PDF manipulation fails', (done) => {
				//mock the first GET /:id/info call
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(200, PDF_1_INFO);

				//mock the follows POST :/id manipulation call
				mockScope
					.post(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}`, manipulations)
					.reply(400);

				ImaginaryService.getInfoConverted(PDF_1_INFO.id)
					.then((returnVal) => {
						//we should not get here
						expect(true).to.equal(false);
						done();
					})
					.catch((err) => {
						expect(err.message).to.contain("Got 'Bad request' trying to manipulate image with Imaginary");
						done();
					});
			});

			it('promise should fail when other non-error status returns while getting PDF info', (done) => {
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(204);

				ImaginaryService.getInfoConverted(PDF_1_INFO.id)
					.then((returnVal) => {
						//we should not get here
						expect(true).to.equal(false);
						done();
					})
					.catch((err) => {
						expect(err).to.be.exist;
						expect(err.message).to.be.exist;

						done();
					});
			});

			it('promise should fail when other non-error status returns while manipulating PDF', (done) => {
				//mock the first GET /:id/info call
				mockScope
					.get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
					.reply(200, PDF_1_INFO);

				//mock the follows POST :/id manipulation call
				mockScope
					.post(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}`, manipulations)
					.reply(204);

				ImaginaryService.getInfoConverted(PDF_1_INFO.id)
					.then((returnVal) => {
						//we should not get here
						expect(true).to.equal(false);
						done();
					})
					.catch((err) => {
						expect(err).to.be.exist;
						expect(err.message).to.be.exist;

						done();
					});
			});
		});
  });

	describe('.isImageFile', () => {
    it('promise should return true when mime-type is image/ typed', (done) => {
      mockScope
        .get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
        .reply(200, IMAGE_1_INFO);

      ImaginaryService.isImageFile(IMAGE_1_INFO.id)
        .then((isImage) => {
          expect(isImage).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('promise should return false when mime-type is not image/ typed', (done) => {
      mockScope
        .get(`${Config.imaginaryApi.imageApi}${PDF_1_INFO.id}${Config.imaginaryApi.infoApi}`)
        .reply(200, PDF_1_INFO);

      ImaginaryService.isImageFile(PDF_1_INFO.id)
        .then((isImage) => {
          expect(isImage).to.equal(false);
          done();
        })
        .catch(done);
    });

    it('promise should fail if image not found', (done) => {
      mockScope
        .get(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}${Config.imaginaryApi.infoApi}`)
        .reply(404);

      ImaginaryService.isImageFile(IMAGE_1_INFO.id)
        .then((isImage) => {
          //we should not get here
          expect(true).to.equal(false);
          done();
        })
        .catch((err) => {
          expect(err.message).to.contains("Image not found on Imaginary service");
          done();
        });
    });
  });

	describe('.pdfToImage', () => {
    let manipulations = [ {
      "action" : "pdftoimage",
      toMime: Config.imaginaryApi.defaultImageFormat
    } ];

		it('promise should return converted image info successfully when 200 returned', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
				.reply(200, IMAGE_1_INFO);

			ImaginaryService.pdfToImage(IMAGE_1_INFO.id)
        .then((returnVal) => {
          expect(returnVal.id).to.equal(IMAGE_1_INFO.id);
          expect(returnVal.cloudinaryId).to.equal(IMAGE_1_INFO.cloudinaryId);
          expect(returnVal.mimeType).to.equal(IMAGE_1_INFO.mimeType);
          done();
        })
				.catch(done);
    });

    it('promise should return converted image info successfully when 201 returned', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
				.reply(201, IMAGE_1_INFO);

			ImaginaryService.pdfToImage(IMAGE_1_INFO.id)
        .then((returnVal) => {
          expect(returnVal.id).to.equal(IMAGE_1_INFO.id);
          expect(returnVal.cloudinaryId).to.equal(IMAGE_1_INFO.cloudinaryId);
          expect(returnVal.mimeType).to.equal(IMAGE_1_INFO.mimeType);
          done();
        })
				.catch(done);
    });

    it('promise should fail if image not found', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
				.reply(404);

			ImaginaryService.pdfToImage(IMAGE_1_INFO.id)
				.then((returnVal) => {
					//we should not get here
					expect(true).to.equal(false);
					done();
				})
				.catch((err) => {
					expect(err.message).to.contain("Failed to manipulate image with Imaginary");
					done();
				});
    });

    it('promise should fail if request exceeding allowed response time', (done) => {
      let originalTimeoutValue = Config.imaginaryApi.requestTimeoutMs;
      Config.imaginaryApi.requestTimeoutMs = 100;

      mockScope
        .post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
        .delayConnection(1000)
        .reply(201, IMAGE_1_INFO);

      ImaginaryService.pdfToImage(IMAGE_1_INFO.id)
        .catch((err) => {
          expect(err.message).to.match(/Imaginary.*timeout/);

          Config.imaginaryApi.requestTimeoutMs = originalTimeoutValue; // restore value
          done();
        });
    });

    it('promise should fail when other non-error status returns', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
				.reply(204);

			ImaginaryService.pdfToImage(IMAGE_1_INFO.id)
				.then((returnVal) => {
					//we should not get here
					expect(true).to.equal(false);
					done();
				})
				.catch((err) => {
					expect(err).to.be.exist;
					expect(err.message).to.be.exist;

					done();
				});
    });
  });

	describe('.createCropImage', () => {
		let manipulations = [ {
      action : "crop",
      toMime: Config.imaginaryApi.defaultImageFormat,
      parameters: {
					topLeft: [ 10, 10 ],
					bottomRight: [ 100, 100 ]
				}
			}
		];

    it('promise should return manipulated image info successfully when 200 returned', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
        .matchHeader("CallingServer", Config.serviceName)
        .matchHeader("Vatbox-User-Id", "foo")
				.reply(200, IMAGE_1_INFO);

			ImaginaryService.createCropImage(IMAGE_1_INFO.id, CROP_AREA_1, "foo")
        .then((returnVal) => {
          expect(returnVal.id).to.equal(IMAGE_1_INFO.id);
          expect(returnVal.cloudinaryId).to.equal(IMAGE_1_INFO.cloudinaryId);
          expect(returnVal.mimeType).to.equal(IMAGE_1_INFO.mimeType);
          done();
        })
				.catch(done);
    });

    it('promise should return converted image info successfully when 201 returned', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
        .matchHeader("CallingServer", Config.serviceName)
        .matchHeader("Vatbox-User-Id", "")
				.reply(201, IMAGE_1_INFO);

			ImaginaryService.createCropImage(IMAGE_1_INFO.id, CROP_AREA_1)
        .then((returnVal) => {
          expect(returnVal.id).to.equal(IMAGE_1_INFO.id);
          expect(returnVal.cloudinaryId).to.equal(IMAGE_1_INFO.cloudinaryId);
          expect(returnVal.mimeType).to.equal(IMAGE_1_INFO.mimeType);
          done();
        })
				.catch(done);
    });

    it('promise should fail if image not found', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
				.reply(404);

			ImaginaryService.createCropImage(IMAGE_1_INFO.id, CROP_AREA_1)
				.then((returnVal) => {
					//we should not get here
					expect(true).to.equal(false);
					done();
				})
				.catch((err) => {
					expect(err.message).to.contain("Failed to manipulate image with Imaginary");
					done();
				});
    });

    it('promise should fail when other non-error status returns', (done) => {
			mockScope
				.post(`${Config.imaginaryApi.imageApi}${IMAGE_1_INFO.id}`, manipulations)
				.reply(204);

			ImaginaryService.createCropImage(IMAGE_1_INFO.id, CROP_AREA_1)
				.then((returnVal) => {
					//we should not get here
					expect(true).to.equal(false);
					done();
				})
				.catch((err) => {
					expect(err).to.be.exist;
					expect(err.message).to.be.exist;

					done();
				});
    });
  });

});
