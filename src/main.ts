import { GitHub } from "@actions/github/lib/github";
import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  const githubContext = github.context;
  const githubToken = core.getInput("repo-token");
  const githubClient = new GitHub(githubToken);

  const pr = githubContext.issue;

  const titleRegex: RegExp = new RegExp(core.getInput("title-regex"));
  const title: string = githubContext.payload.pull_request?.title ?? "";

  const onFailedRegexComment = core
    .getInput("on-failed-regex-comment")
    .replace("%regex%", titleRegex.source);

  core.debug(`Title Regex: ${titleRegex}`);
  core.debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    githubClient.pulls.createReview({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      body: onFailedRegexComment,
      event: "REQUEST_CHANGES",
    });
  } else {
    const reviews = await githubClient.pulls.listReviews({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
    });

    reviews.data.forEach((review) => {
      if (review.user.login == "github-actions[bot]") {
        githubClient.pulls.dismissReview({
          owner: pr.owner,
          repo: pr.repo,
          pull_number: pr.number,
          review_id: review.id,
          message: "All good!",
        });
      }
    });
  }
}

run().catch((error) => {
  core.setFailed(error);
});
