"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasReviewedState = void 0;
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
const onSucceededRegexMinimizeComment = (0, core_1.getInput)("on-succeeded-regex-minimize-comment") === "true";
const onMinimizeCommentReason = (0, core_1.getInput)("on-minimize-comment-reason") || "RESOLVED";
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
            console.log(`PR title matches regex, dismissing any existing reviews`);
            await dismissReview(pullRequest);
            if (onSucceededRegexMinimizeComment) {
                await minimizeReview(pullRequest);
            }
        }
    }
}
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
    (0, core_1.debug)(`Getting reviews`);
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
const minimizeReview = async (pullRequest) => {
    (0, core_1.debug)(`Minimizing existing content on PR #${pullRequest.number}`);
    const review = await getExistingReview(pullRequest);
    if (review) {
        (0, core_1.debug)(`Found existing review with ID: ${review.id}`);
        const reviewNodeId = await getReviewNodeId(review.id, pullRequest);
        if (reviewNodeId) {
            await minimizeReviewById(reviewNodeId, pullRequest);
        }
    }
    else {
        (0, core_1.debug)('No existing reviews found to minimize');
    }
};
const getReviewNodeId = async (reviewDatabaseId, pullRequest) => {
    try {
        const { repository } = await octokit.graphql(`
      query GetReviewNodeId($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            reviews(first: 100) {
              nodes {
                id
                databaseId
              }
            }
          }
        }
      }
    `, {
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            prNumber: pullRequest.number,
        });
        const pullRequestObj = repository?.pullRequest;
        if (!pullRequestObj) {
            (0, core_1.debug)(`No PR found for number ${pullRequest.number}`);
            return null;
        }
        const review = pullRequestObj.reviews.nodes.find(node => node.databaseId === reviewDatabaseId);
        if (review) {
            (0, core_1.debug)(`Found review with node ID: ${review.id}`);
            return review.id;
        }
        (0, core_1.debug)(`No reviews found with database ID: ${reviewDatabaseId}`);
        return null;
    }
    catch (error) {
        (0, core_1.debug)(`Error fetching review node ID: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
};
const minimizeReviewById = async (reviewNodeId, pullRequest) => {
    try {
        (0, core_1.debug)(`Minimizing review with node ID: ${reviewNodeId}`);
        await octokit.graphql(`
      mutation MinimizeComment($input: MinimizeCommentInput!) {
        minimizeComment(input: $input) {
          minimizedComment {
            isMinimized
            minimizedReason
          }
        }
      }
    `, {
            input: {
                subjectId: reviewNodeId,
                classifier: onMinimizeCommentReason,
                clientMutationId: `pr-lint-action-review-${pullRequest.number}-${Date.now()}`,
            },
        });
        (0, core_1.debug)(`Review minimized successfully`);
    }
    catch (error) {
        (0, core_1.debug)(`Failed to minimize review: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
            (0, core_1.debug)(`Stack trace: ${error.stack}`);
        }
    }
};
