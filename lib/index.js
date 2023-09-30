"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("./main");
const core_1 = require("@actions/core");
(0, main_1.run)().catch((error) => {
    if (error instanceof Error) {
        (0, core_1.setFailed)(error);
    }
});
