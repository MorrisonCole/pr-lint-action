"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
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
const bodyRegex = new RegExp((0, core_1.getInput)("body-regex", {
    required: true,
}));
const onFailedBodyRegexFailAction = (0, core_1.getInput)("on-failed-body-regex-fail-action") === "true";
const onFailedBodyRegexCreateReview = (0, core_1.getInput)("on-failed-body-regex-create-review") === "true";
const onFailedBodyRegexRequestChanges = (0, core_1.getInput)("on-failed-body-regex-request-changes") === "true";
const onFailedBodyRegexComment = (0, core_1.getInput)("on-failed-body-regex-comment");
const octokit = (0, github_1.getOctokit)(repoToken);
async function run() {
    const githubContext = github_1.context;
    const pullRequest = githubContext.issue;
    const title = githubContext.payload.pull_request?.title ?? "";
    const body = githubContext.payload.pull_request?.body ?? "";
    const titleComment = onFailedRegexComment.replace("%regex%", titleRegex.source);
    const bodyComment = onFailedBodyRegexComment.replace("%regex%", bodyRegex.source);
    (0, core_1.debug)(`Title Regex: ${titleRegex.source}`);
    (0, core_1.debug)(`Title: ${title}`);
    (0, core_1.debug)(`Body Regex: ${bodyRegex.source}`);
    (0, core_1.debug)(`Body: ${body}`);
    const titleMatchesRegex = titleRegex.test(title);
    const bodyMatchesRegex = bodyRegex.test(body);
    const appendComment = (comment, additionalComment) => comment ? `${comment}\n${additionalComment}` : additionalComment;
    const getComment = (matchesRegex, matters, comment) => (matchesRegex || !matters ? "" : comment);
    const titleReviewComment = getComment(titleMatchesRegex, onFailedRegexCreateReview, titleComment);
    const bodyReviewComment = getComment(bodyMatchesRegex, onFailedBodyRegexCreateReview, bodyComment);
    var actionComment = "";
    actionComment = appendComment(getComment(titleMatchesRegex, onFailedRegexFailAction, titleComment), actionComment);
    actionComment = appendComment(getComment(bodyMatchesRegex, onFailedBodyRegexFailAction, bodyComment), actionComment);
    (0, core_1.debug)(`actionComment: ${actionComment}`);
    (0, core_1.debug)(`titleReviewComment: ${titleReviewComment}`);
    (0, core_1.debug)(`bodyReviewComment: ${bodyReviewComment}`);
    if (onFailedRegexCreateReview &&
        onFailedBodyRegexCreateReview &&
        onFailedRegexRequestChanges == onFailedBodyRegexRequestChanges) {
        await createOrUpdateOrDismissReview(titleMatchesRegex && bodyMatchesRegex, appendComment(titleReviewComment, bodyReviewComment), onFailedRegexRequestChanges, pullRequest);
    }
    else {
        if (onFailedRegexCreateReview) {
            await createOrUpdateOrDismissReview(titleMatchesRegex, titleReviewComment, onFailedRegexRequestChanges, pullRequest);
        }
        if (onFailedBodyRegexCreateReview) {
            await createOrUpdateOrDismissReview(bodyMatchesRegex, bodyReviewComment, onFailedBodyRegexRequestChanges, pullRequest);
        }
    }
    if (actionComment) {
        (0, core_1.setFailed)(actionComment);
    }
}
const createOrUpdateOrDismissReview = async (matched, comment, requestChanges, pullRequest) => {
    const stateFilter = (state) => state == (requestChanges ? "CHANGES_REQUESTED" : "COMMENTED");
    if (matched) {
        await dismissReview(pullRequest, stateFilter);
    }
    else {
        await createOrUpdateReview(comment, requestChanges, pullRequest, stateFilter);
    }
};
const createOrUpdateReview = async (comment, requestChanges, pullRequest, stateFilter) => {
    (0, core_1.debug)(`Create or Update Review: ${comment}`);
    const review = await getExistingReview(pullRequest, stateFilter);
    if (review === undefined) {
        await octokit.rest.pulls.createReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            body: comment,
            event: requestChanges ? "REQUEST_CHANGES" : "COMMENT",
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
const dismissReview = async (pullRequest, stateFilter) => {
    (0, core_1.debug)(`Trying to get existing review`);
    const review = await getExistingReview(pullRequest, stateFilter);
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
const getExistingReview = async (pullRequest, stateFilter) => {
    (0, core_1.debug)(`Getting reviews`);
    const reviews = await octokit.rest.pulls.listReviews({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        pull_number: pullRequest.number,
    });
    return reviews.data.find((review) => {
        return (review.user != null &&
            isGitHubActionUser(review.user.login) &&
            stateFilter(review.state));
    });
};
const isGitHubActionUser = (login) => {
    return login === GITHUB_ACTIONS_LOGIN;
};
