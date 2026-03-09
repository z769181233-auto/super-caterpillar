"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNlpOutput = validateNlpOutput;
function validateNlpOutput(output) {
    return (output &&
        (output.status === 'PASS' || output.status === 'FAIL') &&
        output.metrics &&
        typeof output.metrics.chars === 'number' &&
        output.meta &&
        output.meta.source);
}
//# sourceMappingURL=nlp_output_schema.js.map