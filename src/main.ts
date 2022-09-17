import * as core from "@actions/core";
import * as github from "@actions/github";

const repoToken = core.getInput("repo-token", { required: true });
const titleRegex: RegExp = new RegExp(
  core.getInput("title-regex", {
    required: true,
  })
);
const onFailedRegexFailAction: boolean =
  core.getInput("on-failed-regex-fail-action") === "true";
const onFailedRegexCreateReview: boolean =
  core.getInput("on-failed-regex-create-review") === "true";
const onFailedRegexRequestChanges: boolean =
  core.getInput("on-failed-regex-request-changes") === "true";
const onFailedRegexComment: string = core.getInput("on-failed-regex-comment");
const onSucceededRegexDismissReviewComment: string = core.getInput(
  "on-succeeded-regex-dismiss-review-comment"
);

const octokit = github.getOctokit(repoToken);

async function run(): Promise<void> {
  const githubContext = github.context;
  const pullRequest = githubContext.issue;

  const title: string =
    (githubContext.payload.pull_request?.title as string) ?? "";
  const comment = onFailedRegexComment.replace("%regex%", titleRegex.source);

  core.debug(`Title Regex: ${titleRegex.source}`);
  core.debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    if (onFailedRegexCreateReview) {
      await createReview(comment, pullRequest);
    }
    if (onFailedRegexFailAction) {
      core.setFailed(comment);
    }
  } else {
    if (onFailedRegexCreateReview) {
      await dismissReview(pullRequest);
    }
  }
}

async function createReview(
  comment: string,
  pullRequest: { owner: string; repo: string; number: number }
) {
  await octokit.rest.pulls.createReview({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    pull_number: pullRequest.number,
    body: comment,
    event: onFailedRegexRequestChanges ? "REQUEST_CHANGES" : "COMMENT",
  });
}

async function dismissReview(pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) {
  core.debug(`Trying to dismiss review`);
  const review = await getExistingReview(pullRequest);

  if (review === undefined) {
    core.debug("Found no existing review.");
    return;
  }

  if (review.state === "COMMENTED") {
    var comments = await octokit.rest.pulls.listReviewComments({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
    });

    var existingComment = comments.data.find(
      (_: { id: number; user: { login: string } | null }) => {
        review.user != null && isGitHubActionUser(review.user.login);
      }
    );

    if (existingComment === undefined) {
      core.debug("Found no existing comment.");
      return;
    }

    await octokit.rest.pulls.updateReviewComment({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      comment_id: existingComment.id,
      body: onSucceededRegexDismissReviewComment,
    });
    core.debug(`Updated comment`);
  } else {
    await octokit.rest.pulls.dismissReview({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
      review_id: review.id,
      message: onSucceededRegexDismissReviewComment,
    });
    core.debug(`Review dimissed`);
  }
}

const getExistingReview = async (pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) => {
  core.debug(`getting reviews`);
  const reviews = await octokit.rest.pulls.listReviews({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    pull_number: pullRequest.number,
  });

  core.debug(`got reviews: ${reviews.toString()}`)

  return reviews.data.find(
    (review: { id: number; user: { login: string } | null; state: string }) => {
      review.user != null &&
        isGitHubActionUser(review.user.login) &&
        hasReviewedState(review.state);
    }
  );
};

const isGitHubActionUser = (login: string) => {
  return login === "github-actions[bot]";
};

// See: https://docs.github.com/en/graphql/reference/enums#pullrequestreviewstate
export const hasReviewedState = (state: string) => {
  return state === "CHANGES_REQUESTED" || state === "COMMENTED";
};

run().catch((error) => {
  core.setFailed(error);
});
