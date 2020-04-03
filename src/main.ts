import {GitHub} from '@actions/github/lib/github';
import core from '@actions/core';
import github from '@actions/github';

async function run() {
  const githubContext = github.context;
  const githubToken = core.getInput('repo-token');
  const githubClient: GitHub = new GitHub(githubToken);

  const titleRegex: RegExp = new RegExp(core.getInput('title-regex'));
  const title: string = githubContext.payload.pull_request?.title ?? "";

  const onFailedRegexComment = core
    .getInput('on-failed-regex-comment')
    .replace('%regex%', titleRegex.source);

  core.debug(`Title Regex: ${titleRegex}`);
  core.debug(`Title: ${title}`);

  try {
    if (!titleRegex.test(title)) {
      core.setFailed(onFailedRegexComment);

      const pr = githubContext.issue;
      githubClient.pulls.createReview({
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number,
        body: onFailedRegexComment,
        event: 'COMMENT'
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
