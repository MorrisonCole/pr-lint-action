"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github/lib/github");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
function run() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const githubContext = github.context;
        const githubToken = core.getInput('repo-token');
        const githubClient = new github_1.GitHub(githubToken);
        const titleRegex = new RegExp(core.getInput('title-regex'));
        const title = (_b = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : '';
        const onFailedRegexComment = core
            .getInput('on-failed-regex-comment')
            .replace('%regex%', titleRegex.source);
        core.debug(`Title Regex: ${titleRegex}`);
        core.debug(`Title: ${title}`);
        if (!titleRegex.test(title)) {
            core.setFailed(onFailedRegexComment);
            const pr = githubContext.issue;
            githubClient.pulls.createReview({
                owner: pr.owner,
                repo: pr.repo,
                pull_number: pr.number,
                body: onFailedRegexComment,
                event: 'COMMENT'
            });
        }
    });
}
run().catch(error => {
    core.setFailed(error);
});
