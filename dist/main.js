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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github/lib/github");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const repoTokenInput = core.getInput("repo-token", { required: true });
const githubClient = github_1.getOctokit(repoTokenInput);
const titleRegexInput = core.getInput("title-regex", {
    required: true,
});
const onFailedRegexCreateReviewInput = core.getInput("on-failed-regex-create-review") == "true";
const onFailedRegexCommentInput = core.getInput("on-failed-regex-comment");
const onFailedRegexFailActionInput = core.getInput("on-failed-regex-fail-action") == "true";
async function run() {
    const githubContext = github.context;
    const pullRequest = githubContext.issue;
    const titleRegex = new RegExp(titleRegexInput);
    const title = githubContext.payload.pull_request?.title ?? "";
    const comment = onFailedRegexCommentInput.replace("%regex%", titleRegex.source);
    core.debug(`Title Regex: ${titleRegex.source}`);
    core.debug(`Title: ${title}`);
    const titleMatchesRegex = titleRegex.test(title);
    if (!titleMatchesRegex) {
        if (onFailedRegexCreateReviewInput) {
            createReview(comment, pullRequest);
        }
        if (onFailedRegexFailActionInput) {
            core.setFailed(comment);
        }
    }
    else {
        if (onFailedRegexCreateReviewInput) {
            await dismissReview(pullRequest);
        }
    }
}
function createReview(comment, pullRequest) {
    void githubClient.pulls.createReview({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        pull_number: pullRequest.number,
        body: comment,
        event: "REQUEST_CHANGES",
    });
}
async function dismissReview(pullRequest) {
    const reviews = await githubClient.pulls.listReviews({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        pull_number: pullRequest.number,
    });
    reviews.data.forEach((review) => {
        if (review.user.login == "github-actions[bot]") {
            void githubClient.pulls.dismissReview({
                owner: pullRequest.owner,
                repo: pullRequest.repo,
                pull_number: pullRequest.number,
                review_id: review.id,
                message: "All good!",
            });
        }
    });
}
run().catch((error) => {
    core.setFailed(error);
});
