"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github/lib/github");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
async function run() {
    var _a, _b;
    const githubContext = github.context;
    const githubToken = core.getInput("repo-token");
    const githubClient = github_1.getOctokit(githubToken);
    const pr = githubContext.issue;
    const titleRegex = new RegExp(core.getInput("title-regex"));
    const title = (_b = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : "";
    const onFailedRegexComment = core
        .getInput("on-failed-regex-comment")
        .replace("%regex%", titleRegex.source);
    core.debug(`Title Regex: ${titleRegex}`);
    core.debug(`Title: ${title}`);
    const titleMatchesRegex = titleRegex.test(title);
    if (!titleMatchesRegex) {
        githubClient.pulls.createReview({
            owner: pr.owner,
            repo: pr.repo,
            pull_number: pr.number,
            body: onFailedRegexComment,
            event: "REQUEST_CHANGES",
        });
    }
    else {
        const reviews = await githubClient.pulls.listReviews({
            owner: pr.owner,
            repo: pr.repo,
            pull_number: pr.number,
        });
        reviews.data.forEach((review) => {
            if (review.user.login == "github-actions[bot]") {
                githubClient.pulls.dismissReview({
                    owner: pr.owner,
                    repo: pr.repo,
                    pull_number: pr.number,
                    review_id: review.id,
                    message: "All good!",
                });
            }
        });
    }
}
run().catch((error) => {
    core.setFailed(error);
});
