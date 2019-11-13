var harvester_prod = db.getSiblingDB("harvester_prod");

var doneImages = harvester_prod.images.find( {status: "waitingTask", cropAreasOriginId: {$exists: true}, 'nextTask.task': {$exists: false}})

var index = 0;
while(doneImages.hasNext()) {
    print("*************************************************");
    index++;
    var image = doneImages.next();
    print("curr image ", image._id);
    harvester_prod.images.update({_id: image._id}, {$set: {'nextTask.task': 'processComplete'}})
    print("updated!");
}

print("*************************************************");
print('total images updated: ' + index)