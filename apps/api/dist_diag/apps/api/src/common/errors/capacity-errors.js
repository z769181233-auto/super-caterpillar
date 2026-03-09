"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacityExceededException = exports.CapacityErrorMessages = exports.CapacityErrorCode = void 0;
var CapacityErrorCode;
(function (CapacityErrorCode) {
    CapacityErrorCode["CAPACITY_EXCEEDED_CONCURRENT"] = "CAPACITY_EXCEEDED_CONCURRENT";
    CapacityErrorCode["CAPACITY_EXCEEDED_QUEUE"] = "CAPACITY_EXCEEDED_QUEUE";
    CapacityErrorCode["CAPACITY_EXCEEDED_TOTAL_QUEUE"] = "CAPACITY_EXCEEDED_TOTAL_QUEUE";
    CapacityErrorCode["CAPACITY_EXCEEDED_USER_CONCURRENT"] = "CAPACITY_EXCEEDED_USER_CONCURRENT";
})(CapacityErrorCode || (exports.CapacityErrorCode = CapacityErrorCode = {}));
exports.CapacityErrorMessages = {
    [CapacityErrorCode.CAPACITY_EXCEEDED_CONCURRENT]: '当前并发渲染任务已达上限，请等待部分任务完成后再试',
    [CapacityErrorCode.CAPACITY_EXCEEDED_QUEUE]: '渲染队列积压过多，请稍后再试',
    [CapacityErrorCode.CAPACITY_EXCEEDED_TOTAL_QUEUE]: '系统队列繁忙，请稍后再试',
    [CapacityErrorCode.CAPACITY_EXCEEDED_USER_CONCURRENT]: '您的并发渲染任务已达上限，请等待部分任务完成后再试',
};
class CapacityExceededException extends Error {
    errorCode;
    currentCount;
    limit;
    constructor(errorCode, currentCount, limit, message) {
        super(message || exports.CapacityErrorMessages[errorCode]);
        this.errorCode = errorCode;
        this.currentCount = currentCount;
        this.limit = limit;
        this.name = 'CapacityExceededException';
    }
}
exports.CapacityExceededException = CapacityExceededException;
//# sourceMappingURL=capacity-errors.js.map