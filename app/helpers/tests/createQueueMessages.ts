import {QueueApi, eQueues, IIncomingMessage, MessageHandlerCallback} from "../../utils/queueApi";


const createMessage = (count: number) => {
  return JSON.stringify({
    imageId: "imageId_" + count,
    entityId: "entityId_" + count,
    tags: ["tag1", "tag2"],
    source: "bulk",
    reportId: "reportId_" + count
  });

};

for (let i=0; i<3; i++){
  QueueApi.send(createMessage(i), eQueues.longPoll);
}
