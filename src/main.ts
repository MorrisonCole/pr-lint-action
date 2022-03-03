import * as core from "@actions/core";
import * as github from "@actions/github";

const repoTokenInput = core.getInput("repo-token", { required: true });
const octokit = github.getOctokit(repoTokenInput);

const titleRegexInput: string = core.getInput("title-regex", {
  required: true,
});
const bodyRegexInput: string = core.getInput("body-regex", {
  required: false,
});
const onFailedRegexCreateReviewInput: boolean =
  core.getInput("on-failed-regex-create-review") === "true";
const onFailedRegexCommentInput: string = core.getInput(
  "on-failed-regex-comment"
);
const onFailedRegexFailActionInput: boolean =
  core.getInput("on-failed-regex-fail-action") === "true";
const onFailedRegexRequestChanges: boolean =
  core.getInput("on-failed-regex-request-changes") === "true";
const onSucceededRegexDismissReviewComment: string = core.getInput(
  "on-succeeded-regex-dismiss-review-comment"
);

async function run(): Promise<void> {
  const githubContext = github.context;
  const pullRequest = githubContext.issue;

  const titleRegex = new RegExp(titleRegexInput);
  const title: string =
    (githubContext.payload.pull_request?.title as string) ?? "";
  const body: string = githubContext.payload.pull_request?.body ?? "";
  const comment = onFailedRegexCommentInput.replace(
    "%regex%",
    titleRegex.source
  );

  core.debug(`Title Regex: ${titleRegex.source}`);
  core.debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    if (onFailedRegexCreateReviewInput) {
      createReview(comment, pullRequest);
    }
    if (onFailedRegexFailActionInput) {
      core.setFailed(comment);
    }
    core.debug(`Failing title: ${title}`);
  } else {
    core.debug(`Regex pass`);
    if (onFailedRegexCreateReviewInput) {
      core.debug(`Dismissing review`);
      await dismissReview(pullRequest);
      core.debug(`Review dimissed`);
    }
  }

  if (bodyRegexInput) {
    const bodyRegex = new RegExp(bodyRegexInput);
    if (bodyRegex.test(body)) {
      if (onFailedRegexCreateReviewInput) {
        createReview(comment, pullRequest);
      }
      if (onFailedRegexFailActionInput) {
        core.setFailed(comment);
      }
      core.debug(`Failing body: ${body}`);
    } else {
      core.debug(`Regex pass`);
      if (onFailedRegexCreateReviewInput) {
        core.debug(`Dismissing review`);
        await dismissReview(pullRequest);
        core.debug(`Review dimissed`);
      }
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

function alreadyRequiredChanges(state: string) {
  // If on-failed-regex-request-changes is set to be true state will be CHANGES_REQUESTED
  // otherwise the bot will just comment and the state will be COMMENTED.
  const requiredChanges =
    state === "CHANGES_REQUESTED" || state === "COMMENTED";
  core.debug(
    `alreadyRequiredChanges output: ${requiredChanges} (state is: ${state})`
  );
  return requiredChanges;
}

run().catch((error) => {
  core.setFailed(error);
});
