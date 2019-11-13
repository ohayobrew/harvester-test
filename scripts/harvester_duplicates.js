harvester = db.getSiblingDB("harvester_duplicates");

function distinct(flags, arr) {
	var distinctArr = [], i;
	for( i=0; i< arr.length; i++) {
	    if( flags[arr[i]] > 0) 
	    	flags[arr[i]]++;
	    else
	    {
	    	flags[arr[i]] = 1;
			distinctArr.push(arr[i]);
		}
	};
	return distinctArr;
}

//Migrate all transactionIds to be at the new format reportId#imaginaryIdOriginal

harvester.images.createIndex({"requestMetadata.transactionId":1},{background:true, sparse:true});

var allImagesWithRequestMetadata = harvester.images.find({"requestMetadata.transactionId" : {$exists:true}});

var i=0;

while (allImagesWithRequestMetadata.hasNext()) {
	var nextImage = allImagesWithRequestMetadata.next();
	if (!nextImage.requestMetadata.transactionId.contains("#"))
	{
		i++;
		var newTransactionId = nextImage.requestMetadata.reportId +"#" + nextImage.imaginaryIdOriginal;
		harvester.images.updateOne({_id:nextImage._id},{$set: {"requestMetadata.transactionId" : newTransactionId}});
	}
}

print("Updated " + i + " documents");

//Done migrating.


//Move all duplicates to images_duplicates

var duplicates = harvester.images.aggregate([
{ $match: { "requestMetadata.transactionId": {$exists: true} } },
{ $group: { _id: {"transactionId" : "$requestMetadata.transactionId"}, count:{ $sum:1 } } },
{ $match: {count: {$gt: 1}}}
] ,{ allowDiskUse: true}).toArray();

// flags = [];
// var distinctCountVals = distinct(flags, duplicates.map(d=>d.count));

// var distinctValsWithAmount = distinctCountVals.map(function(dcv) {
// 	return {
// 		"NumOfduplicates" : dcv,
// 		"amount" : flags[dcv]
// 	}
// }).sort(function(a, b) { return a.NumOfduplicates - b.NumOfduplicates });

duplicates.forEach(d=> {
	var images = harvester.images.find({"requestMetadata.transactionId" : d._id.transactionId})
	.sort({updatedAt:-1, createdAt:-1}).toArray();
	if (images.length == 1) return;
	if (images.some(i=>i.status !="done"))
	{
		var imagesWithStatusDone = images.filter(i=>i.status=="done")
		if (imagesWithStatusDone.length > 0)
		{
			var imageIdToSkip = imagesWithStatusDone[0]._id;
			var toTransfer = images.filter(i=> i._id != imageIdToSkip);
			harvester.images_duplicates.insertMany(toTransfer);
			harvester.images.deleteMany({"requestMetadata.transactionId":d._id.transactionId, _id:{$ne:imageIdToSkip}});
		}
		else
		{
			var imageIdToSkip = images[0]._id;
			var toTransfer = images.filter(i=> i._id != imageIdToSkip);
			harvester.images_duplicates.insertMany(toTransfer);
			harvester.images.deleteMany({"requestMetadata.transactionId":d._id.transactionId, _id:{$ne:imageIdToSkip}});
		}
	}
	else if (images.every(i=>i.status == "done"))
	{
		var imageIdToSkip = images[0]._id;
		var toTransfer = images.filter(i=> i._id != imageIdToSkip);
		harvester.images_duplicates.insertMany(toTransfer);
		harvester.images.deleteMany({"requestMetadata.transactionId":d._id.transactionId, _id:{$ne:imageIdToSkip}});
	}
});

//Done moving all duplicates.


harvester.images.dropIndex("requestMetadata.transactionId_1");
//Create unique index
harvester.images.createIndex({"requestMetadata.transactionId":1},{background:true, unique:true, sparse:true});