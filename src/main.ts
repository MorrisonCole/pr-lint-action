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
const onSucceededRegexMinimizeComment: boolean =
  getInput("on-succeeded-regex-minimize-comment") === "true";
const onMinimizeCommentReason: string = getInput("on-minimize-comment-reason") || "resolved";

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

    if (onSucceededRegexMinimizeComment) {
      await minimizeExistingComments(pullRequest);
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

// Find all previous comments created by the bot on this PR
const getExistingComments = async (pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) => {
  debug(`Getting comments for PR #${pullRequest.number}`);
  const comments = await octokit.rest.issues.listComments({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    issue_number: pullRequest.number,
  });

  return comments.data.filter(
    (comment: { user: { login: string } | null }) => {
      return comment.user !== null && isGitHubActionUser(comment.user.login);
    },
  );
};

// Get a comment's global node ID using GraphQL
const getCommentNodeId = async (
  commentDatabaseId: number,
  pullRequest: {
    owner: string;
    repo: string;
    number: number;
  }
) => {
  try {
    const { repository } = await octokit.graphql<{
      repository: {
        issueOrPullRequest: {
          comments: {
            nodes: Array<{ id: string }>;
          };
        };
      };
    }>(`
      query GetCommentNodeId($owner: String!, $repo: String!, $prNumber: Int!, $commentDatabaseId: Int!) {
        repository(owner: $owner, name: $repo) {
          issueOrPullRequest(number: $prNumber) {
            ... on Issue {
              comments(first: 1, where: {databaseId: $commentDatabaseId}) {
                nodes {
                  id
                }
              }
            }
            ... on PullRequest {
              comments(first: 1, where: {databaseId: $commentDatabaseId}) {
                nodes {
                  id
                }
              }
            }
          }
        }
      }
    `, {
      owner: pullRequest.owner,
      repo: pullRequest.repo,
      prNumber: pullRequest.number,
      commentDatabaseId: commentDatabaseId,
    });

    const issueOrPR = repository?.issueOrPullRequest;
    if (!issueOrPR) return null;

    const comments = issueOrPR.comments.nodes;
    if (comments && comments.length > 0) {
      return comments[0].id;
    }
    return null;
  } catch (error) {
    debug(`Error fetching comment node ID: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

// Minimize all comments created by the bot
const minimizeExistingComments = async (pullRequest: {
  owner: string;
  repo: string;
  number: number;
}) => {
  debug(`Minimizing existing comments on PR #${pullRequest.number}`);
  const comments = await getExistingComments(pullRequest);

  for (const comment of comments) {
    debug(`Processing comment with database ID: ${comment.id}`);
    const nodeId = await getCommentNodeId(comment.id, pullRequest);
    if (nodeId) {
      await minimizeComment(nodeId, pullRequest);
    } else {
      debug(`Could not find node ID for comment ${comment.id}`);
    }
  }
};

// Use GitHub GraphQL API to minimize a comment
const minimizeComment = async (
  commentNodeId: string,
  pullRequest: {
    owner: string;
    repo: string;
    number: number;
  }
) => {
  try {
    debug(`Minimizing comment with node ID: ${commentNodeId}`);
    const { minimizeComment: result } = await octokit.graphql<{
      minimizeComment: {
        minimizedComment: {
          isMinimized: boolean;
          minimizedReason: string;
        };
      };
    }>(`
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
        subjectId: commentNodeId,
        classifier: onMinimizeCommentReason,
        clientMutationId: `pr-lint-action-${pullRequest.number}-${Date.now()}`,
      },
    });

    debug(`Comment minimized successfully: ${JSON.stringify(result)}`);
  } catch (error) {
    debug(`Failed to minimize comment: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      debug(`Stack trace: ${error.stack}`);
    }
  }
};

const dismissReview = async (pullRequest: {
  owner: string;
  repo: string;
  number: number,
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
