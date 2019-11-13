
var harvester_prod = db.getSiblingDB("harvester_prod");
var expedite_prod = db.getSiblingDB("expedite_prod");
var turbine_prod = db.getSiblingDB("turbine_prod");

var errorImages = harvester_prod.images.find( {status: "error", requestMetadata: {$exists: true}})

var index = 0;
var imagesIds = [];

while(errorImages.hasNext()) {
    print("*************************************************");
    index++;
    print("curr image " + index);
    var image = errorImages.next();
    var requestMetadata = image.requestMetadata
    
    var isExistInExpedite = expedite_prod.evidences.find({ 'metadata.workloadId': requestMetadata.workloadId, 'metadata.companyId': requestMetadata.companyId, 'matadata.reportId': requestMetadata.reportId }).count() > 0;
    if (isExistInExpedite) {
        print("image id: " + image._id + " is exist in expedite_prod: "  + isExistInExpedite);
    }
    
    var cropAreasIds = image.cropAreas.map(function(crop) {
        return crop._id;
    });

    var query = Object.assign({}, { 
        'header.workloadId': requestMetadata.workloadId, 
        'header.companyId': requestMetadata.companyId, 
        'header.reportId': requestMetadata.reportId, 
        evidences: {$elemMatch: {'metadata.documentId': {$in: cropAreasIds}}} 
    });
    var isExistInTurbine = turbine_prod.reports.find(query).count() > 0;
    if (isExistInTurbine) {
        print("image id: " + image._id + " is exist in turbine_prod: "  + isExistInTurbine);
    }

    if (!isExistInExpedite && !isExistInTurbine) {
        imagesIds.push(image._id)
    }
}

print("*************************************************");

var ids = imagesIds.map(function(objId) {
    return objId.str;
});
print(ids)