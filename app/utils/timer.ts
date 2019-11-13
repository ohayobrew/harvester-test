
class Time {
    private startTime: number;

    constructor(start: number) {
        this.startTime = start;
    }

    end() {
        return Date.now() - this.startTime
    }
}

export class Timer {

    static start(): Time {
        return new Time(Date.now())
    }
}