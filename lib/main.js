"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.hasReviewedState = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const GITHUB_ACTIONS_LOGIN = "github-actions[bot]";
const repoToken = core.getInput("repo-token", { required: true });
const titleRegex = new RegExp(core.getInput("title-regex", {
    required: true,
}));
const onFailedRegexFailAction = core.getInput("on-failed-regex-fail-action") === "true";
const onFailedRegexCreateReview = core.getInput("on-failed-regex-create-review") === "true";
const onFailedRegexRequestChanges = core.getInput("on-failed-regex-request-changes") === "true";
const onFailedRegexComment = core.getInput("on-failed-regex-comment");
const onSucceededRegexDismissReviewComment = core.getInput("on-succeeded-regex-dismiss-review-comment");
const octokit = github.getOctokit(repoToken);
function run() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const githubContext = github.context;
        const pullRequest = githubContext.issue;
        const title = (_b = (_a = githubContext.payload.pull_request) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : "";
        const comment = onFailedRegexComment.replace("%regex%", titleRegex.source);
        core.debug(`Title Regex: ${titleRegex.source}`);
        core.debug(`Title: ${title}`);
        const titleMatchesRegex = titleRegex.test(title);
        if (!titleMatchesRegex) {
            if (onFailedRegexCreateReview) {
                yield createReview(comment, pullRequest);
            }
            if (onFailedRegexFailAction) {
                core.setFailed(comment);
            }
        }
        else {
            if (onFailedRegexCreateReview) {
                yield dismissReview(pullRequest);
            }
        }
    });
}
function createReview(comment, pullRequest) {
    return __awaiter(this, void 0, void 0, function* () {
        yield octokit.rest.pulls.createReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            body: comment,
            event: onFailedRegexRequestChanges ? "REQUEST_CHANGES" : "COMMENT",
        });
    });
}
function dismissReview(pullRequest) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug(`Trying to dismiss review`);
        const review = yield getExistingReview(pullRequest);
        if (review === undefined) {
            core.debug("Found no existing review.");
            return;
        }
        if (review.state === "COMMENTED") {
            var comments = yield octokit.rest.pulls.listCommentsForReview({
                owner: pullRequest.owner,
                repo: pullRequest.repo,
                pull_number: pullRequest.number,
                review_id: review.id
            });
            core.debug(`got comments: ${JSON.stringify(comments)}`);
            var existingComment = comments.data.find((_) => {
                return review.user != null && isGitHubActionUser(review.user.login);
            });
            if (existingComment === undefined) {
                core.debug("Found no existing comment.");
                return;
            }
            yield octokit.rest.pulls.updateReviewComment({
                owner: pullRequest.owner,
                repo: pullRequest.repo,
                comment_id: existingComment.id,
                body: onSucceededRegexDismissReviewComment,
            });
            core.debug(`Updated comment`);
        }
        else {
            yield octokit.rest.pulls.dismissReview({
                owner: pullRequest.owner,
                repo: pullRequest.repo,
                pull_number: pullRequest.number,
                review_id: review.id,
                message: onSucceededRegexDismissReviewComment,
            });
            core.debug(`Review dimissed`);
        }
    });
}
const getExistingReview = (pullRequest) => __awaiter(void 0, void 0, void 0, function* () {
    core.debug(`getting reviews`);
    const reviews = yield octokit.rest.pulls.listReviews({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        pull_number: pullRequest.number,
    });
    return reviews.data.find((review) => {
        return review.user != null &&
            isGitHubActionUser(review.user.login) &&
            (0, exports.hasReviewedState)(review.state);
    });
});
const isGitHubActionUser = (login) => {
    return login === GITHUB_ACTIONS_LOGIN;
};
const hasReviewedState = (state) => {
    return state === "CHANGES_REQUESTED" || state === "COMMENTED";
};
exports.hasReviewedState = hasReviewedState;
run().catch((error) => {
    core.setFailed(error);
});
