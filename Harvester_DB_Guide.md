# Harvester DB Guide

Hi there, you probably got here because you are trying to make sense of the mess here. 

I'm here to help!

Last updated: 2018-08-26

## Collections - Why, What and WTF

### Overview
~~~
PRODUCTION-IRELAND:SECONDARY> use harvester
PRODUCTION-IRELAND:SECONDARY> show collections
DatabaseMetadata_SchemaMap
config
feature_flags
image_status_tasks
images
images_archived
images_deleted
images_duplicates
imaginary_retry
users
~~~
Let's go over each collection, its reason, and what you may (or may not) find there.

### ``images``
This the main application collection. 
Each document corresponds to some image requiring our services.

Notable fields:

* ``imaginaryIdOriginal``: image we will apply auto/manual crop. Service assumes it passed Imaginary's digest successfully.
* ``cropAreas``: Always defined (starting with an empty array). Each element corresponds to one future outbound message. 
	* ``imaginaryId``: outbound imaginary that reaches Expedite
	* ``transactionId``: used when building sqs-message metadata (i.e. ``metadata.transactionId`)
	* ``_id``: Will become the ``metadata.documentId`` 
* ``status``
	* `inProgress`: image is waiting for users' help.
	* `waitingTask` OR `sendingToQueue`: part of background process when publishing data to expedite.
	* `done`: background process completed successfully on **all** crop areas.
	* `error`: background process failed. `nextTask` sub-document will contain all errors. If a recurring issue is identified, we can force a retry using a dedicated API.
* ``nextTask``: internal background action management.
* ``completedTasks``: internal tracking of completed background actions (for example, successful creation of an imaginaryId based on cropArea coordinates).
* ``requestedSkipCrop`` && ``skippedCrop``: Indication of skip-user request, and did we except it.

### ``users``
Internal list of users. 

Say again? We have ``FatLady`` **and** ``Lemmings``, why do we need this?

You are correct, however, Harvester is older than both. So at the beginning, it had to manage users internally. Now days, each internal-user has a reference to the actual ``user_id`` used in the NG-systems:

~~~
PRODUCTION-IRELAND:SECONDARY> db.users.find().sort({ _id: -1}).limit(1).pretty()
{
	"_id" : ObjectId("<harvester_internal_user_id>"),
	"vatboxUserId" : "<string_value_of_lemmings_user_id>",
	"email" : "my_ng_user_name@vatbox.com",
	"tags" : [ ],
	"__v" : 0
}
~~~

So, whenever you see a ref to a ``user_id`` in any other collection, match it with a ``user`` in this collection to get to actual ``vatbox-user-id``

### ``config``
Basically, the priority queue.
Collection contains a single doc, updated by user's request.

### ``images_archived``
Well, this is the interesting part. As stated, Harvester is super old. 

Once upon a time, when the world was new, and NG was just a whisper, Rails needed help doing all the image crops. It would send an Api request to Harvester, which did it's magic, and when finished, would update Rails. Lovely, right?

Then came the old proxy (``Scapegoat``). And Harvester needed to support both early-days NG data **AND** Rails direct contact. Confused? It doesn't end. NG images assumed some-kind of pre-harvester-image processing (similar to digest now days, only it wasn't digest). Also, need to output data differently, right? So, lots and lots of optional fields were added. And **then**, came the current proxy (``Scapelamb``) which added the ``workloadId``. Needless to mention no data-migration was done at any point.

Why am I telling you all this?

This is where this collection comes in. It keeps all the old data, the ``images`` collection holds **ONLY** data with a valid `workloadId`. If you ever find a need to research super old data, this collection is going to be your playground. My condolences.

### ``images_deleted``
At the point this doc was written, NG doesn't support auto-replay of messed up data. (Such as disabling an entity in Rails during NG-process).
Whenever some sort of data reset was needed, bad images were moved here, and deleted from the main collection.

### ``images_duplicates``
Another **FUN** part!!

Remember the 4-tuple metadata? So, in Harvester it's a 3-tuple (workloadId, reportId, companyId). But the uniqueness here isn't strong enough - Each 3-tuple may correspond to multiple images. Being the case, Harvester enforces uniqueness on `transactionId` (and some other application level helpers depending on `imaginaryIdOrigianl`). 

However, the service failed to create even the `transactionId` uniqueness. As the index was requested after data already existed. 

This collection is our way of enforcing the uniqueness without losing the ability to track old data if needed. In case we found multiple docs with the same `transactionId`, the main collection saved the most updated, the rest of the docs were moved here.

### ``image_status_tasks``
Internal lock collection - prevents multiple pods running the same long query on the DB (Datadog metric regarding current statuses in the DB).

### ``feature_flags``
Some features can be turned on/off by request demand. Specifically, the new pre-ocr helper. A corresponding Api may be found, no need to manually change the DB.
