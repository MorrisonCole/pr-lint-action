"use strict";
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
async function run() {
    var _a, _b;
    const githubContext = github.context;
    const githubToken = core.getInput('repo-token');
    const githubClient = new github_1.GitHub(githubToken);
    const pr = githubContext.issue;
    const titleRegex = new RegExp(core.getInput('title-regex'));
    const title = (_b = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : '';
    const onFailedRegexComment = core
        .getInput('on-failed-regex-comment')
        .replace('%regex%', titleRegex.source);
    core.debug(`Title Regex: ${titleRegex}`);
    core.debug(`Title: ${title}`);
    const titleMatchesRegex = titleRegex.test(title);
    if (!titleMatchesRegex) {
        githubClient.pulls.createReview({
            owner: pr.owner,
            repo: pr.repo,
            pull_number: pr.number,
            body: onFailedRegexComment,
            event: 'REQUEST_CHANGES'
        });
    }
}
run().catch(error => {
    core.setFailed(error);
});
