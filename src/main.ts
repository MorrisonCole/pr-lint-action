import {GitHub} from '@actions/github/lib/github';
import * as core from '@actions/core';
import * as github from '@actions/github';

async function run(): Promise<void> {
  const githubContext = github.context;
  const githubToken = core.getInput('repo-token');
  const githubClient = new GitHub(githubToken);

  const pr = githubContext.issue;

  const titleRegex: RegExp = new RegExp(core.getInput('title-regex'));
  const title: string = githubContext.payload.pull_request?.title ?? '';

  const onFailedRegexComment = core
    .getInput('on-failed-regex-comment')
    .replace('%regex%', titleRegex.source);

  core.debug(`Title Regex: ${titleRegex}`);
  core.debug(`Title: ${title}`);

  const titleMatchesRegex: boolean = titleRegex.test(title);
  if (!titleMatchesRegex) {
    core.setFailed(onFailedRegexComment);
    
    githubClient.pulls.createReview({
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      body: onFailedRegexComment,
      event: 'COMMENT'
    });
  }

  await githubClient.repos.createStatus({
    owner: pr.owner,
    repo: pr.repo,
    sha: process.env.GITHUB_SHA ?? "",
    state: titleMatchesRegex ? 'success' : 'failure',
    context: 'MorrisonCole/pr-lint',
  });
}

run().catch(error => {
  core.setFailed(error);
});
