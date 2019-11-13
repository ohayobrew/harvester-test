# Harvester
Service for cropping images

## Getting started

```bash
# install the dependencies with npm
$ npm install
```

### Test

This configuration will be used: [`/constants/config.json`](/constants/config.json)

```bash
$ npm test
```

### Debugging

```bash
# start the server, use config from db collection 'config'
$ npm start
```

## API

## Image [/api/exposed/v1.0/image]

### Get next [GET]
### Get next by entity id [GET /entity/:entityId]

> Use `/entity/:entityId` when requesting image by specific entity id.

+ Response 200 (application/json)

  + Body
    
    ```json
    {
      "id": "58d9019abbb9e707003a25ea",
      "createdAt": "2017-03-27T12:12:10.152Z",
      "updatedAt": "2017-03-27T15:11:11.986Z",
      "imageUrl": "/api/imaginary/v1.0/undefined",
      "imaginaryId": "588f02c12d00000574b0fc11",
      "cropAreas": [
        {
          "id": "58d92b3b5907a2070094b643",
          "x": 36,
          "y": 110,
          "width": 1570,
          "height": 9183,
          "status": "fresh"
        },
        {
          "id": "58d92b3c5907a2070094b644",
          "x": 470,
          "y": 9436,
          "width": 996,
          "height": 2316,
          "status": "fresh"
        }
      ],
      "status": "done",
      "entityId": "3044"
    }
    ```
  + Schema
  
    ```json
    {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "definitions": {},
        "id": "http://example.com/example.json",
        "properties": {
            "createdAt": {
                "type": "string"
            },
            "cropAreas": {
                "items": {
                    "properties": {
                        "height": {
                            "type": "integer"
                        },
                        "id": {
                            "type": "string"
                        },
                        "status": {
                            "default": "fresh",
                            "description": "Obsolete - used when created invoices directly in Rails",
                            "type": "string"
                        },
                        "width": {
                            "type": "integer"
                        },
                        "x": {
                            "type": "integer"
                        },
                        "y": {
                            "type": "integer"
                        }
                    },
                    "required": [
                        "height",
                        "width",
                        "y",
                        "x",
                        "id"
                    ],
                    "type": "object"
                },
                "minItems": 0,
                "type": "array"
            },
            "entityId": {
                "type": "string"
            },
            "id": {
                "type": "string"
            },
            "imageUrl": {
                "description": "Obsolete - used with images received from old uploader",
                "type": "string"
            },
            "imaginaryId": {
                "type": "string"
            },
            "status": {
                "default": "inProgress",
                "type": "string"
            },
            "updatedAt": {
                "type": "string"
            }
        },
        "required": [
            "status",
            "cropAreas",
            "entityId",
            "id",
            "createdAt",
            "imaginaryId"
        ],
        "type": "object"
    }
    ```
    
+ Response 204

  No image to return

+ Response 400 

  With error message

+ Response 401

+ Response 403
  
  Not authorized
    
+ Response 500

### Get image by id [GET /:imageId]

Return specific image by id

+ Response 200 

  As get next image response 200

+ Response 400 

  Image not exist / error

+ Response 401

+ Response 403
  
  Not authorized
    
+ Response 500

### Add crop area to image [POST /:imageId/area]

+ `:imageId` - id of image containing the new area

+ Request (application/json)

  + Body
    
    ```json
    {
        "x": 470,
        "y": 9436,
        "width": 996,
        "height": 2316
    }
    ```
  + Schema
  
    ```json
    {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "properties": {
            "height": {
                "type": "integer"
            },
            "width": {
                "type": "integer"
            },
            "x": {
                "description": "Left point",
                "type": "integer"
            },
            "y": {
                "description": "Top point",
                "type": "integer"
            }
        },
        "required": [
            "y",
            "x",
            "height",
            "width"
        ],
        "type": "object"
    }
    ```

+ Response 201 (application/json)
  
  + Body
    
    ```json
    {
        "id": "58d92b3b5907a2070094b643", 
        "status": "fresh"
    }
    ```  
    
  + Schema
    
    ```json
    {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "definitions": {},
        "id": "http://example.com/example.json",
        "properties": {
            "id": {
                "description": "Id of created crop area",
                "type": "string"
            },
            "status": {
                "default": "fresh",
                "description": "Obsolete",
                "type": "string"
            }
        },
        "type": "object"
    }
    ```
      
+ Response 400 

+ Response 401

+ Response 403
  
  Not authorized or image was locked by another user
    
+ Response 500

### Delete crop area  [DELETE /:imageId/area/:areaId]

+ `:imageId` - id of image removing crop area from

+ `:areaId` - id of crop area

+ Response 200

  Crop area was removed

+ Response 400 

  Not removed / other error (will be provided)

+ Response 401

+ Response 403
  
  Not authorized
    
+ Response 500

### Complete  [POST /:imageId/action/:verb]

This API call will cause to status chane of an image, and starting of an async operation that actually creating cropped images using `Imaginary` service, then each crop area will be sent as an outgoing message to `Expedite`.
It is allowed to change status to `done` without having cropped areas, in that case an outgoing message will be sent to `Turbine` service.

+ `:imageId` - id of completing (done/reject) image
+ `:verb` - one of `done`/`reject`

+ Response 200

  Completed successfully

+ Response 400

  Could not change status / other error (will be provided) 

  inProgress = 'inProgress',
  done = 'done',
  rejected = 'rejected',
  creatingInvoices = 'creatingInvoices',
  failedCreatingAllInvoices = 'failedCreatingAllInvoices',
  error = 'error',
  sendingToQueue = 'sendingToQueue',
  waitingTask = 'waitingTask',
  manuallyIgnored = 'manuallyIgnored',
  badFile = 'badFile',
  potentiallyBadFile = 'potentiallyBadFile'
// inProgress - ready for user to do crop process
// done - all crop areas created and submitted (to rails/expedite/matcher)
// rejected - rejected by user
// creatingInvoices - middle state while communicating with rails
// failedCreatingAllInvoices - not in use
// error - had an error
// sendingToQueue - middle state while sending to queue
// waitingTask - status for queueing task for later. set nextTask.task with the desired one

### Image status definition
| Status  | Description |
| ------------- | ------------- |
| inProgress| ready for user to do crop process  |
| done  | all crop areas created and submitted (to rails/expedite/matcher)  |
| rejected  | rejected by user  |
| creatingInvoices  | middle state while communicating with rails  |
| failedCreatingAllInvoices  | not in use  |
| error  | had an error  |
| sendingToQueue  | middle state while sending to queue  |
| waitingTask  | status for queueing task for later. set nextTask.task with the desired one  |
| potentiallyBadFile  | an image file that failed to load in the back office  |
| badFile  | A potentiallyBadFile that has > config.retryCounts occurrence  |


## Images [/api/exposed/v1.0/images]

### Create [POST] or SQS queue
Create a new image.
+ Request body / SQS message body
  + metadata
    + `workloadId`: string,
    + `reportId`: string - duplication of "data.reportId",
    + `companyId`: string (optional) - duplication of "data.entityId",
    + `transactionId`: string - will ignore if already received a message with the same value
  + data
    + `imageId` - imaginary id of digested report.
    + `entityId` - company id under rails.
    + `tags` (optional) - supply it when need to match with user tags (image without tags will be shown only to users without tags).
    + `source` - name of service doing the request.
    + `reportId` - required.

+ Response for POST request
  + It will respond with `400` in the following cases:
    + Tags supplied but not as an array.
    + Creation failed, reason will be logged.
  
  + Request (application/json)
      
      + Body
            
          ```json
          {
              "metadata": {
                "workloadId": "5909c6b63500009300a74cb3",
                "reportId": "B350C5FE931E4D45B225",
                "companyId": "2552",
                "transactionId": "5909c6ed186f5f07007366ac"
              },
              "data": {
                "imageId": "58500c883700001705d03104",
                "entityId": "2552",
                "tags": ["myTag"],
                "reportId": "B350C5FE931E4D45B225",
                "skipCrop": false
              }      
          }
          ```
              
      + Schema
                
          ```json
          {
            "$schema": "http://json-schema.org/draft-04/schema#",
            "properties": {
              "data": {
                "properties": {
                  "entityId": {
                    "description": "company id in rails",
                    "type": "string"
                  },
                  "imageId": {
                    "description": "imaginary id of digested report",
                    "type": "string"
                  },
                  "reportId": {
                    "type": "string"
                  },
                  "source": {
                    "default": "rest_api_v1.0",
                    "description": "origin service",
                    "type": "string"
                  },
                  "tags": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  },
                  "skipCrop": {
                    "default": "false",
                    "description": "equal true when there is no need for manual cropping. the image will be sent to next service (expedite) as a single crop area",
                    "type": "boolean"
                  }
                },
                "required": [
                  "entityId",
                  "reportId",
                  "imageId"
                ],
                "type": "object"
              },
              "metadata": {
                "properties": {
                  "companyId": {
                    "description": "copy of 'entityId'",
                    "type": "string"
                  },
                  "reportId": {
                    "type": "string"
                  },
                  "transactionId": {
                    "type": "string"
                  },
                  "workloadId": {
                    "type": "string"
                  }
                },
                "required": [
                  "transactionId",
                  "reportId",
                  "workloadId"
                ],
                "type": "object"
              }
            },
            "required": [
              "data",
              "metadata"
            ],
            "type": "object"
          }
          ```
        
  + Response 201
      + Image created
      
  + Response 400 
  
  + Response 401
  
  + Response 403
      
  + Response 500
  
### Query images [GET /]

Return images by status

+ Request
  
  + Parameters
  
    + limit: `1001` (integer, required) - max results
    + offset: `2000` (integer, required)
    + entityId: `"2552"` (string, optional) - query by entity id
    + status: `"inProgress"` (string, optional) - query by status
        
        Possible values: `inProgress`, `done`, `error`, `sendingToQueue`, `waitingTask`.

+ Response 200 (application/json)

  + Body
  
    ```json
    {
      "total": 10, 
      "images": []
    }
    ```
    > `images` is an array with objects similar to response 200 of get next image

+ Response 204
 
  No results

+ Response 400 

  Error

+ Response 401

+ Response 403
  
  Not authorized
    
+ Response 500

## On done cropping
### Done and having crop areas

Crop areas will be created either automatically or with users help, each converted to an image using Imaginary, upon success, images will be passed to Expedite:

  + Body 
  
      ```json
      {
        "image": {
          "reportId": "57cbe0e11200003e0870a488",
          "originalImageId": "5916d80a5330f406003220c0",
          "croppedImageId": "5916c0bc2d0000e9cbc9f717",
          "croppedImageNum": 1,
          "croppedImagesTotal": 1
        },
        "metadata": {
          "workloadId": "5916d696370000d3134f2d68",
          "transactionId": "57e8eee00a4eb60700ad8ee4",
          "documentId": "59197c9586fe67000778f5a3",
          "companyId": "4268",
          "reportId": "57cbe0e11200003e0870a488",
          "callbackQueue": {
            "name": "matcher-inbound-evidence-staging"
          }
        },
        "source": "harvester",
        "sourceId": "59197b7629d7ef0007e36da4",
        "entityId": "4268",
        "returnQueueUrl": "https://sqs.eu-west-1.amazonaws.com/395499912268/matcher-inbound-evidence-staging",
        "imageUrl": "https://backoffice.k8rnd.vatbox.com/api/imaginary/v1.0/5916c0bc2d0000e9cbc9f717",
        "sourceClientUrl": "https://backoffice.k8rnd.vatbox.com/#/cropping/review/59197b7629d7ef0007e36da4"
      }
      ```
      
  + Schema
              
      ```json
      {
          "$schema": "http://json-schema.org/draft-04/schema#",
          "properties": {
              "entityId": {
                  "description": "Duplication of 'metadata.companyId'",
                  "type": "string"
              },
              "image": {
                  "properties": {
                      "croppedImageId": {
                          "description": "Imaginary Id of cropped area",
                          "type": "string"
                      },
                      "croppedImageNum": {
                          "description": "Index for the cropped area",
                          "type": "integer"
                      },
                      "croppedImagesTotal": {
                          "description": "Total cropped areas created",
                          "type": "integer"
                      },
                      "originalImageId": {
                          "description": "Imaginary Id of the original report (after digest)",
                          "type": "string"
                      },
                      "reportId": {
                          "description": "Duplication of 'metadata.reportId'",
                          "type": "string"
                      }
                  },
                  "required": [
                      "croppedImageId",
                      "croppedImagesTotal",
                      "originalImageId",
                      "reportId",
                      "croppedImageNum"
                  ],
                  "type": "object"
              },
              "imageUrl": {
                  "description": "URL of cropped image",
                  "type": "string"
              },
              "metadata": {
                  "properties": {
                      "callbackQueue" : {
                          "type" : "object",
                          "properties" : {
                            "name" : {
                              "type" : "string"
                            },
                            "region" : {
                              "type" : "string"
                            }
                          },
                          "required" : [ "name" ]
                      },
                      "companyId": {
                          "type": "string"
                      },
                      "documentId": {
                          "description": "Equal to cropped area id",
                          "type": "string"
                      },
                      "reportId": {
                          "type": "string"
                      },
                      "transactionId": {
                          "type": "string"
                      },
                      "workloadId": {
                          "type": "string"
                      }
                  },
                  "required": [
                      "companyId",
                      "callbackQueue",
                      "reportId",
                      "workloadId",
                      "transactionId",
                      "documentId"
                  ],
                  "type": "object"
              },
              "returnQueueUrl": {
                  "description": "Let expedite know what SQS queue URL should be used when completing hit",
                  "type": "string"
              },
              "source": {
                  "default": "harvester",
                  "type": "string"
              },
              "sourceClientUrl": {
                  "description": "URL of the editing screen of the image, can be used as reference for users",
                  "type": "string"
              },
              "sourceId": {
                  "description": "Equal to image id",
                  "type": "string"
              }
          },
          "required": [
              "sourceId",
              "image",
              "source",
              "returnQueueUrl",
              "entityId",
              "imageUrl",
              "metadata"
          ],
          "type": "object"
      }
      ```
### Done with no crop areas  
If there are no crop areas for the image, this message will be sent, directly to `Turbine` queue:
      
  + Body 
  
      ```json
      {
        "image": {
          "reportId": "57cbe0e11200003e0870a488",
          "originalImageId": "5916d80a5330f406003220c0",
          "croppedImageNum": 0,
          "croppedImagesTotal": 0
        },
        "metadata": {
          "workloadId": "5916d696370000d3134f2d68",
          "transactionId": "57e8eee00a4eb60700ad8ee4",
          "companyId": "4268",
          "reportId": "57cbe0e11200003e0870a488"
        },
        "source": "harvester",
        "sourceId": "59197b7629d7ef0007e36da4",
        "rejected": false,
        "inScope": false
      }
      ```
      
  + Schema
                
      ```json
      {
          "$schema": "http://json-schema.org/draft-04/schema#",
          "properties": {
              "image": {
                  "properties": {
                      "croppedImageNum": {
                          "default": 0,
                          "description": "No cropped areas",
                          "type": "integer"
                      },
                      "croppedImagesTotal": {
                          "default": 0,
                          "description": "No cropped areas",
                          "type": "integer"
                      },
                      "originalImageId": {
                          "description": "Imaginary Id of the original report (after digest)",
                          "type": "string"
                      },
                      "reportId": {
                          "description": "Duplication of 'metadata.reportId'",
                          "type": "string"
                      }
                  },
                  "required": [
                      "croppedImagesTotal",
                      "originalImageId",
                      "reportId",
                      "croppedImageNum"
                  ],
                  "type": "object"
              },
              "inScope": {
                  "default": false,
                  "description": "this field is typically added in Expedite service",
                  "type": "boolean"
              },
              "metadata": {
                  "properties": {
                      "companyId": {
                          "type": "string"
                      },
                      "reportId": {
                          "type": "string"
                      },
                      "transactionId": {
                          "type": "string"
                      },
                      "workloadId": {
                          "type": "string"
                      }
                  },
                  "required": [
                      "transactionId",
                      "reportId",
                      "workloadId",
                      "companyId"
                  ],
                  "type": "object"
              },
              "rejected": {
                  "default": false,
                  "description": "this field is typically added in Expedite service",
                  "type": "boolean"
              },
              "source": {
                  "default": "harvester",
                  "type": "string"
              },
              "sourceId": {
                  "description": "Equal to image id",
                  "type": "string"
              }
          },
          "required": [
              "sourceId",
              "image",
              "rejected",
              "source",
              "inScope",
              "metadata"
          ],
          "type": "object"
      }
      ```

## Failures [/api/exposed/v1.0/images]

### Failure [GET /failure/count?from=date&to=date]
Return the count of images with status `error` and max `nextTask.retries `.

filter options:

+ from: date (timestamp)
+ to: date (timestamp)

### Failure [POST /failure/reset]
Update images with `status: error` and max `nextTask.retries` to `status: waitingTask` and reset the retries `nextTask.retries: 0`

+ example:

```json
    {
        "ids": ["id1", "id2"]
    }
```

filter options:

+ from: date (timestamp)
+ to: date (timestamp)
+ ids - array of image ids

## Reports [/api/exposed/v1.0/images/report]

### Entities by inProgress status [GET /entities/statuses/inProgress]
Return a list of all entity ids, sorted by priorities, with counter of `inProgress` status for each

  + Response 200 (application/json)

      ```json
          [
            {
              "entityId": "3226",
              "inProgress": 0
            },
            {
              "entityId": "723",
              "inProgress": 45
            }
          ]
      ```
      
  + Response 204 ("No results")
      
      if no images at all
  
  + Response 401
  
  + Response 403
      
  + Response 500

### Mark image as single [POST /image/:imageId/single]

+ `:imageId` - id of single image

+ Response 200

  Completed successfully
      
+ Response 400 
  
  Could not do this action duo to user is not locked on this image or image not found
  
  
# Config [/api/exposed/v1.0/config]

## Entity priorities [POST /entityPriorities]
Set prioritization by entityId for which images will be queried by in next tasks.
Expect for array of strings in request body.


  + Request (application/json)
      + Body
            
         ```json
          ["1234", "2222"]
         ```
              
              
+ Response for POST request
        
  + Response 200
      + Saved successfully
      
  + Response 400 
      + Body is not an array of strings
  
  + Response 401
  
  + Response 403
      
  + Response 500

# Feature flag [/api/exposed/v1.0/feature]

### List Features [GET /feature]
Expect for array features data in response body.

+ Request (application/json)      
                     
+ Response for GET request
        
	+ Response 200
  		+ Body
            
         ```json
          [
		      	{
		      		id: 'kmk2e21',
		      		name: 'featureName',
		      		isOn: true
		      	}
      		]
         ```
         
  + Response 400 
      + Body 
	      
	      ```
	      {message: 'error!'}
	      ```

### Feature details [GET /feature/:id]
Return specific feature data by id in response body.

+ `:id` - feature id 

+ Request (application/json)  

+ Response for GET request
        
	+ Response 200
  		+ Body
            
         ```json
          {
	      		id: 'kmk2e21',
	      		name: 'featureName',
	      		isOn: true
	      	}
         ```
         
  + Response 400 
      + Body 
	      
	      ```
	      {message: 'error!'}
	      ```           

### Turn On/Off Feature Flag [POST /feature/:id]
To turn on/off specific feature send id in url and isOn in body.
In the response body you will get the new status

+ `:id` - feature id 

+ Request (application/json)  
	+ Body
    
	    ```json
	    {
	        "isOn": true
	    }
	    ```
    
 	+ Schema
              
      ```json
      {
          "properties": {
              "isOn": {
                  "description": "set feature as on/ off",
                  "type": "boolean"
              }
          }
      }
      ```


+ Response for POST request
        
	+ Response 200
  		+ Body
            
         ```json
          {
	      		id: 'kmk2e21',
	      		name: 'featureName',
	      		isOn: true
	      	}
         ```
         
  + Response 400 
      + Body 
	      
	      ```
	      {message: 'error!'}
	      ```           



# FAQ

**How to recover image documents with `error` status?**

The service retry executing failed operations few times (as configured, currently three times), and for each failure it saves the error message under `nextTask.errorLog` of the property.
In case the max retries was reached, it is possible to have more retries by setting the retries counter `nextTask.retries` value to zero.