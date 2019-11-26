import {GitHub} from '@actions/github/lib/github';

const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  const githubContext = github.context;
  const githubToken = core.getInput('github-token');
  const githubClient: GitHub = new GitHub(githubToken);

  const titleRegex = new RegExp(core.getInput('title-regex'));
  const title = githubContext.payload.pull_request.title;

  const onFailedRegexComment = core.getInput('on-failed-regex-comment')
    .replace('%pattern%', titleRegex.source);

  try {
    if (!titleRegex.test(title)) {
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

// noinspection JSIgnoredPromiseFromCall
run();
