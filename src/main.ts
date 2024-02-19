import { getInput, debug, setFailed } from "@actions/core";
import { getOctokit, context } from "@actions/github";

const GITHUB_ACTIONS_LOGIN = "github-actions[bot]";

const repoToken = getInput("repo-token", { required: true });
const titleRegex: RegExp = new RegExp(
  getInput("title-regex", {
    required: true,
  }),
);
const onFailedRegexFailAction: boolean =
  getInput("on-failed-regex-fail-action") === "true";
const onFailedRegexCreateReview: boolean =
  getInput("on-failed-regex-create-review") === "true";
const onFailedRegexRequestChanges: boolean =
  getInput("on-failed-regex-request-changes") === "true";
const onFailedRegexComment: string = getInput("on-failed-regex-comment");
const onSucceededRegexDismissReviewComment: string = getInput(
  "on-succeeded-regex-dismiss-review-comment",
);

const octokit = getOctokit(repoToken);

export async function run(): Promise<void> {
  const githubContext = context;
  const pullRequest = githubContext.issue;

  const title: string =
    (githubContext.payload.pull_request?.title as string) ?? "";
  const comment = onFailedRegexComment.replace("%regex%", titleRegex.source);

  debug(`Title Regex: ${titleRegex.source}`);
  debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    if (onFailedRegexCreateReview) {
      await createOrUpdateReview(comment, pullRequest);
    }
    if (onFailedRegexFailAction) {
      setFailed(comment);
    }
  } else {
    if (onFailedRegexCreateReview) {
      await dismissReview(pullRequest);
    }
  }
}

const createOrUpdateReview = async (
  comment: string,
  pullRequest: { owner: string; repo: string; number: number },
) => {
  const review = await getExistingReview(pullRequest);

  if (review === undefined) {
    await octokit.rest.pulls.createReview({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
      body: comment,
      event: onFailedRegexRequestChanges ? "REQUEST_CHANGES" : "COMMENT",
    });
  } else {
    await octokit.rest.pulls.updateReview({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
      review_id: review.id,
      body: comment,
    });
  }
};

const dismissReview = async (pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) => {
  debug(`Trying to get existing review`);
  const review = await getExistingReview(pullRequest);

  if (review === undefined) {
    debug("Found no existing review");
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

    debug(`Updated existing review`);
  } else {
    await octokit.rest.pulls.dismissReview({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
      review_id: review.id,
      message: onSucceededRegexDismissReviewComment,
    });
    debug(`Dismissed existing review`);
  }
};

const getExistingReview = async (pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) => {
  debug(`Getting reviews`);
  const reviews = await octokit.rest.pulls.listReviews({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    pull_number: pullRequest.number,
  });

  return reviews.data.find(
    (review: { user: { login: string } | null; state: string }) => {
      return (
        review.user != null &&
        isGitHubActionUser(review.user.login) &&
        hasReviewedState(review.state)
      );
    },
  );
};

const isGitHubActionUser = (login: string) => {
  return login === GITHUB_ACTIONS_LOGIN;
};

// See: https://docs.github.com/en/graphql/reference/enums#pullrequestreviewstate
export const hasReviewedState = (state: string) => {
  return state === "CHANGES_REQUESTED" || state === "COMMENTED";
};
