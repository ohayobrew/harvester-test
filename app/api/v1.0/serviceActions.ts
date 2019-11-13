export default class ServiceActions {

  // the :: syntax is a VATbox internal syntax
  static get data(): any {
    return {
      image: {
        byId: "Image::GetById",
        next: "Image::GetNext",
        nextByEntity: "Image::GetNextByEntity",
        complete: "Image::Complete",
        area: {
          create: "ImageCropArea::Create",
          delete: "ImageCropArea::Delete"
        }
      },
      images: {
        query: "Image::Query",
        failedQuery: "Image::FailedQuery",
        byImaginaryId: "Image::QueryByImaginaryId",
        report: {
          entities: {
            statuses: "EntityReport::GetStatus",
            inProgress: "EntityReport::GetInProgressStatus",
            performance: "EntityReport::GetPerformance"
          },
          users: {
            performance: "UserReport::GetPerformance"
          }
        }
      },
      config: {
        entityPriorities: {
          write: "EntityPriorities::Set"
        }
      },
      featureFlag: {
        toggle: "Feature::Toggle"
      }
    }
  }
}
