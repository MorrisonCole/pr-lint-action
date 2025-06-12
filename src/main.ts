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

const bodyRegex: RegExp = new RegExp(
  getInput("body-regex", {
    required: true,
  }),
);
const onFailedBodyRegexFailAction: boolean =
  getInput("on-failed-body-regex-fail-action") === "true";
const onFailedBodyRegexCreateReview: boolean =
  getInput("on-failed-body-regex-create-review") === "true";
const onFailedBodyRegexRequestChanges: boolean =
  getInput("on-failed-body-regex-request-changes") === "true";
const onFailedBodyRegexComment: string = getInput(
  "on-failed-body-regex-comment",
);

const octokit = getOctokit(repoToken);

export async function run(): Promise<void> {
  const githubContext = context;
  const pullRequest = githubContext.issue;

  const title: string =
    (githubContext.payload.pull_request?.title as string) ?? "";
  const body: string =
    (githubContext.payload.pull_request?.body as string) ?? "";
  const titleComment = onFailedRegexComment.replace(
    "%regex%",
    titleRegex.source,
  );
  const bodyComment = onFailedBodyRegexComment.replace(
    "%regex%",
    bodyRegex.source,
  );

  debug(`Title Regex: ${titleRegex.source}`);
  debug(`Title: ${title}`);
  debug(`Body Regex: ${bodyRegex.source}`);
  debug(`Body: ${body}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  const bodyMatchesRegex: boolean = bodyRegex.test(body);

  const appendComment = (comment: string, additionalComment: string) =>
    comment ? `${comment}\n${additionalComment}` : additionalComment;

  const getComment = (
    matchesRegex: boolean,
    matters: boolean,
    comment: string,
  ) => (matchesRegex || !matters ? "" : comment);
  const titleReviewComment = getComment(
    titleMatchesRegex,
    onFailedRegexCreateReview,
    titleComment,
  );
  const bodyReviewComment = getComment(
    bodyMatchesRegex,
    onFailedBodyRegexCreateReview,
    bodyComment,
  );

  var actionComment = "";
  actionComment = appendComment(
    getComment(titleMatchesRegex, onFailedRegexFailAction, titleComment),
    actionComment,
  );
  actionComment = appendComment(
    getComment(bodyMatchesRegex, onFailedBodyRegexFailAction, bodyComment),
    actionComment,
  );

  debug(`actionComment: ${actionComment}`);
  debug(`titleReviewComment: ${titleReviewComment}`);
  debug(`bodyReviewComment: ${bodyReviewComment}`);

  if (
    onFailedRegexCreateReview &&
    onFailedBodyRegexCreateReview &&
    onFailedRegexRequestChanges == onFailedBodyRegexRequestChanges
  ) {
    await createOrUpdateOrDismissReview(
      titleMatchesRegex && bodyMatchesRegex,
      appendComment(titleReviewComment, bodyReviewComment),
      onFailedRegexRequestChanges,
      pullRequest,
    );
  } else {
    if (onFailedRegexCreateReview) {
      await createOrUpdateOrDismissReview(
        titleMatchesRegex,
        titleReviewComment,
        onFailedRegexRequestChanges,
        pullRequest,
      );
    }
    if (onFailedBodyRegexCreateReview) {
      await createOrUpdateOrDismissReview(
        bodyMatchesRegex,
        bodyReviewComment,
        onFailedBodyRegexRequestChanges,
        pullRequest,
      );
    }
  }

  if (actionComment) {
    setFailed(actionComment);
  }
}

const createOrUpdateOrDismissReview = async (
  matched: boolean,
  comment: string,
  requestChanges: boolean,
  pullRequest: { owner: string; repo: string; number: number },
) => {
  // See: https://docs.github.com/en/graphql/reference/enums#pullrequestreviewstate
  const stateFilter = (state: string) =>
    state == (requestChanges ? "CHANGES_REQUESTED" : "COMMENTED");
  if (matched) {
    await dismissReview(pullRequest, stateFilter);
  } else {
    await createOrUpdateReview(
      comment,
      requestChanges,
      pullRequest,
      stateFilter,
    );
  }
};

const createOrUpdateReview = async (
  comment: string,
  requestChanges: boolean,
  pullRequest: { owner: string; repo: string; number: number },
  stateFilter: (state: string) => Boolean,
) => {
  debug(`Create or Update Review: ${comment}`);
  const review = await getExistingReview(pullRequest, stateFilter);

  if (review === undefined) {
    await octokit.rest.pulls.createReview({
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      pull_number: pullRequest.number,
      body: comment,
      event: requestChanges ? "REQUEST_CHANGES" : "COMMENT",
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

const dismissReview = async (
  pullRequest: {
    owner: string;
    repo: string;
    number: number;
  },
  stateFilter: (state: string) => Boolean,
) => {
  debug(`Trying to get existing review`);
  const review = await getExistingReview(pullRequest, stateFilter);

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

const getExistingReview = async (
  pullRequest: {
    owner: string;
    repo: string;
    number: number;
  },
  stateFilter: (state: string) => Boolean,
) => {
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
        stateFilter(review.state)
      );
    },
  );
};

const isGitHubActionUser = (login: string) => {
  return login === GITHUB_ACTIONS_LOGIN;
};
