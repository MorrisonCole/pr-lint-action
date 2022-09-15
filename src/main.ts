import * as core from "@actions/core";
import * as github from "@actions/github";

const repoToken = core.getInput("repo-token", { required: true });
const titleRegex: RegExp = new RegExp(core.getInput("title-regex", {
  required: true,
}));
const onFailedRegexFailAction: boolean =
  core.getInput("on-failed-regex-fail-action") === "true";
const onFailedRegexCreateReview: boolean =
  core.getInput("on-failed-regex-create-review") === "true";
const onFailedRegexRequestChanges: boolean =
  core.getInput("on-failed-regex-request-changes") === "true";
const onFailedRegexComment: string = core.getInput(
  "on-failed-regex-comment"
);
const onSucceededRegexDismissReviewComment: string = core.getInput(
  "on-succeeded-regex-dismiss-review-comment"
);

const octokit = github.getOctokit(repoToken);

async function run(): Promise<void> {
  const githubContext = github.context;
  const pullRequest = githubContext.issue;

  const title: string =
    (githubContext.payload.pull_request?.title as string) ?? "";
  const comment = onFailedRegexComment.replace(
    "%regex%",
    titleRegex.source
  );

  core.debug(`Title Regex: ${titleRegex.source}`);
  core.debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    if (onFailedRegexCreateReview) {
      createReview(comment, pullRequest);
    }
    if (onFailedRegexFailAction) {
      core.setFailed(comment);
    }
  } else {
    core.debug(`Regex pass`);
    if (onFailedRegexCreateReview) {
      core.debug(`Dismissing review`);
      await dismissReview(pullRequest);
      core.debug(`Review dimissed`);
    }
  }
}

function createReview(
  comment: string,
  pullRequest: { owner: string; repo: string; number: number }
) {
  void octokit.rest.pulls.createReview({
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
  const reviews = await octokit.rest.pulls.listReviews({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    pull_number: pullRequest.number,
  });

  reviews.data.forEach(
    (review: { id: number; user: { login: string } | null; state: string }) => {
      if (
        review.user != null &&
        isGitHubActionUser(review.user.login) &&
        alreadyRequiredChanges(review.state)
      ) {
        core.debug(`Already required changes`);
        if (review.state === "COMMENTED") {
          octokit.rest.issues.createComment({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            issue_number: pullRequest.number,
            body: onSucceededRegexDismissReviewComment,
          });
        } else {
          octokit.rest.pulls.dismissReview({
            owner: pullRequest.owner,
            repo: pullRequest.repo,
            pull_number: pullRequest.number,
            review_id: review.id,
            message: onSucceededRegexDismissReviewComment,
          });
        }
      }
    }
  );
}

function isGitHubActionUser(login: string) {
  const gitHubUser = login === "github-actions[bot]";
  core.debug(`isGitHubActionUser output: ${gitHubUser} (login is: ${login})`);
  return gitHubUser;
}

// See: https://docs.github.com/en/graphql/reference/enums#pullrequestreviewstate
export const alreadyRequiredChanges = (state: string) => {
  // If on-failed-regex-request-changes is set to be true state will be CHANGES_REQUESTED
  // otherwise the bot will just comment and the state will be COMMENTED.
  const requiredChanges =
    state === "CHANGES_REQUESTED" || state === "COMMENTED";
  core.debug(
    `alreadyRequiredChanges output: ${requiredChanges} (state is: ${state})`
  );
  return requiredChanges;
};

run().catch((error) => {
  core.setFailed(error);
});
