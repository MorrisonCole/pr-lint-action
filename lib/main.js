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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const repoTokenInput = core.getInput("repo-token", { required: true });
const octokit = github.getOctokit(repoTokenInput);
const titleRegexInput = core.getInput("title-regex", {
    required: true,
});
const onFailedRegexCreateReviewInput = core.getInput("on-failed-regex-create-review") == "true";
const onFailedRegexCommentInput = core.getInput("on-failed-regex-comment");
const onFailedRegexFailActionInput = core.getInput("on-failed-regex-fail-action") == "true";
const onFailedRegexRequestChanges = core.getInput("on-failed-regex-request-changes") == "true";
const onSucceededRegexDismissReviewComment = core.getInput("on-succeeded-regex-dismiss-review-comment");
function run() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const githubContext = github.context;
        const pullRequest = githubContext.issue;
        const titleRegex = new RegExp(titleRegexInput);
        const title = (_b = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : "";
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
            core.debug(`Regex pass`);
            if (onFailedRegexCreateReviewInput) {
                core.debug(`Dismissing review`);
                yield dismissReview(pullRequest);
                core.debug(`Review dimissed`);
            }
        }
    });
}
function createReview(comment, pullRequest) {
    void octokit.rest.pulls.createReview({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        pull_number: pullRequest.number,
        body: comment,
        event: onFailedRegexRequestChanges ? "REQUEST_CHANGES" : "COMMENT",
    });
}
function dismissReview(pullRequest) {
    return __awaiter(this, void 0, void 0, function* () {
        const reviews = yield octokit.rest.pulls.listReviews({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
        });
        reviews.data.forEach((review) => {
            if (review.user != null &&
                isGitHubActionUser(review.user.login) &&
                alreadyRequiredChanges(review.state)) {
                core.debug(`Found review to dismiss`);
                void octokit.rest.pulls.dismissReview({
                    owner: pullRequest.owner,
                    repo: pullRequest.repo,
                    pull_number: pullRequest.number,
                    review_id: review.id,
                    message: onSucceededRegexDismissReviewComment,
                });
            }
        });
    });
}
function isGitHubActionUser(login) {
    const gitHubUser = login == "github-actions[bot]";
    core.debug(`isGitHubActionUser output: ${gitHubUser} (login is: ${login})`);
    return gitHubUser;
}
function alreadyRequiredChanges(state) {
    const stateIsChangesRequested = state == "CHANGES_REQUESTED";
    core.debug(`alreadyRequiredChanges output: ${stateIsChangesRequested} (state is: ${state})`);
    return stateIsChangesRequested;
}
run().catch((error) => {
    core.setFailed(error);
});
