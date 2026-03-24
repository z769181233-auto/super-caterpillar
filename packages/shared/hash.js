"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256File = sha256File;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
async function sha256File(filePath) {
    return await new Promise((resolve, reject) => {
        const h = (0, crypto_1.createHash)('sha256');
        const rs = (0, fs_1.createReadStream)(filePath);
        rs.on('data', (d) => h.update(d));
        rs.on('error', reject);
        rs.on('end', () => resolve(h.digest('hex')));
    });
}
//# sourceMappingURL=hash.js.map