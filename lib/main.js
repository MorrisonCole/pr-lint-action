"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasReviewedState = exports.run = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const GITHUB_ACTIONS_LOGIN = "github-actions[bot]";
const repoToken = (0, core_1.getInput)("repo-token", { required: true });
const titleRegex = new RegExp((0, core_1.getInput)("title-regex", {
    required: true,
}));
const onFailedRegexFailAction = (0, core_1.getInput)("on-failed-regex-fail-action") === "true";
const onFailedRegexCreateReview = (0, core_1.getInput)("on-failed-regex-create-review") === "true";
const onFailedRegexRequestChanges = (0, core_1.getInput)("on-failed-regex-request-changes") === "true";
const onFailedRegexComment = (0, core_1.getInput)("on-failed-regex-comment");
const onSucceededRegexDismissReviewComment = (0, core_1.getInput)("on-succeeded-regex-dismiss-review-comment");
const octokit = (0, github_1.getOctokit)(repoToken);
async function run() {
    const githubContext = github_1.context;
    const pullRequest = githubContext.issue;
    const title = githubContext.payload.pull_request?.title ?? "";
    const comment = onFailedRegexComment.replace("%regex%", titleRegex.source);
    (0, core_1.debug)(`Title Regex: ${titleRegex.source}`);
    (0, core_1.debug)(`Title: ${title}`);
    const titleMatchesRegex = titleRegex.test(title);
    if (!titleMatchesRegex) {
        if (onFailedRegexCreateReview) {
            await createOrUpdateReview(comment, pullRequest);
        }
        if (onFailedRegexFailAction) {
            (0, core_1.setFailed)(comment);
        }
    }
    else {
        if (onFailedRegexCreateReview) {
            await dismissReview(pullRequest);
        }
    }
}
exports.run = run;
const createOrUpdateReview = async (comment, pullRequest) => {
    const review = await getExistingReview(pullRequest);
    if (review === undefined) {
        await octokit.rest.pulls.createReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            body: comment,
            event: onFailedRegexRequestChanges ? "REQUEST_CHANGES" : "COMMENT",
        });
    }
    else {
        await octokit.rest.pulls.updateReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            review_id: review.id,
            body: comment,
        });
    }
};
const dismissReview = async (pullRequest) => {
    (0, core_1.debug)(`Trying to get existing review`);
    const review = await getExistingReview(pullRequest);
    if (review === undefined) {
        (0, core_1.debug)("Found no existing review");
        return;
    }
    if (review.state === "COMMENTED") {
        await octokit.rest.pulls.updateReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            review_id: review.id,
            body: onSucceededRegexDismissReviewComment,
        });
        (0, core_1.debug)(`Updated existing review`);
    }
    else {
        await octokit.rest.pulls.dismissReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            review_id: review.id,
            message: onSucceededRegexDismissReviewComment,
        });
        (0, core_1.debug)(`Dismissed existing review`);
    }
};
const getExistingReview = async (pullRequest) => {
    (0, core_1.debug)(`getting reviews`);
    const reviews = await octokit.rest.pulls.listReviews({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        pull_number: pullRequest.number,
    });
    return reviews.data.find((review) => {
        return (review.user != null &&
            isGitHubActionUser(review.user.login) &&
            (0, exports.hasReviewedState)(review.state));
    });
};
const isGitHubActionUser = (login) => {
    return login === GITHUB_ACTIONS_LOGIN;
};
const hasReviewedState = (state) => {
    return state === "CHANGES_REQUESTED" || state === "COMMENTED";
};
exports.hasReviewedState = hasReviewedState;
