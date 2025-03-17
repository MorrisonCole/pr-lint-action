# Pull Request Linter [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

:octocat: A fast 🔥 TypeScript GitHub Action to ensure that your PR title
matches a given regex.

Supports the following feedback mechanisms 🛠:

- 🤖 Review, request/dismiss changes, and comment with bot
- ❌ Fail action

## Usage

Create a workflow definition at `.github/workflows/<my-workflow>.yml` with
something like the following contents:

```yaml
name: PR Lint

on:
  pull_request:
    # By default, a workflow only runs when a pull_request's activity type is opened, synchronize, or reopened. We
    # explicity override here so that PR titles are re-linted when the PR text content is edited.
    #
    # Possible values: https://help.github.com/en/actions/reference/events-that-trigger-workflows#pull-request-event-pull_request
    types: [opened, edited, reopened, synchronize]

jobs:
  pr-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: morrisoncole/pr-lint-action@v1.7.1
        with:
          # Note: if you have branch protection rules enabled, the `GITHUB_TOKEN` permissions
          # won't cover dismissing reviews. Your options are to pass in a custom token
          # (perhaps by creating some sort of 'service' user and creating a personal access
          # token with the correct permissions) or to turn off `on-failed-regex-request-changes`
          # and use action failure to prevent merges instead (with
          # `on-failed-regex-fail-action: true`). See:
          # https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token
          # https://docs.github.com/en/rest/pulls/reviews#dismiss-a-review-for-a-pull-request
          repo-token: "${{ secrets.GITHUB_TOKEN }}"
          title-regex: "#[eE][xX]-[0-9]+"
          on-failed-regex-fail-action: false
          on-failed-regex-create-review: true
          on-failed-regex-request-changes: false
          on-failed-regex-comment:
            "This is just an example. Failed regex: `%regex%`!"
          on-succeeded-regex-dismiss-review-comment:
            "This is just an example. Success!"
```

## Options

| Option                                      | Required? | Type   | Default Value                      | Description                                                                                                                                                   |
| ------------------------------------------- | --------- | ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repo-token`                                | yes       | string | N/A                                | [About the `GITHUB_TOKEN` secret](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#about-the-github_token-secret).           |
| `title-regex`                               | yes       | string | ".\*"                              | A JavaScript regex to test the title of each Pull Request against. Allows anything by default.                                                                |
| `on-failed-regex-fail-action`               | no        | bool   | false                              | If the regex fails, sets the action status to failed. When the action exits it will be with an exit code of 1.                                                |
| `on-failed-regex-create-review`             | no        | bool   | true                               | If the regex fails, uses the GitHub review mechanism to submit a review. The review type is determined by `on-failed-regex-request-changes`.                  |
| `on-failed-regex-request-changes`           | no        | bool   | true                               | Uses 'Request Changes' when creating a review. Otherwise, uses 'Comment'. _Note:_ if `on-failed-regex-create-review` is `false`, this won't do anything.      |
| `on-failed-regex-comment`                   | no        | string | "PR title failed to match %regex%" | Comment for the bot to post on PRs that fail the regex (or the console output if `on-failed-regex-create-review` is `false`). Use %regex% to reference regex. |
| `on-succeeded-regex-dismiss-review-comment` | no        | string | "All good!"                        | The message to post as a comment when the regex succeeds after previously failing.                                                                            |

## Changelog

### v1.7.1

- Upgrade Node from 16 -> 20 ([thanks @sirLisko](https://github.com/MorrisonCole/pr-lint-action/pull/735)! 🙏).

### v1.7.0

- Fixes [#389](https://github.com/MorrisonCole/pr-lint-action/issues/389): once
  the bot has commented once, it will now update that comment rather than
  creating new ones.
- Fixes [#333](https://github.com/MorrisonCole/pr-lint-action/issues/333):
  removed trailing period from the end of the default error message.

### v1.6.1

- Fixes [#266](https://github.com/MorrisonCole/pr-lint-action/issues/266): the
  success comment will now be created once the PR Lint succeeds, even when
  `on-failed-regex-create-review` is set to false. Thank you @talboren for
  reporting, debugging, and fixing this! 💪

### v1.6.0

- Updated documentation to recommend running the action on PR `synchronize`
  events too, so that the checks won't go stale.
- Fixes [#175](https://github.com/MorrisonCole/pr-lint-action/issues/175): can
  now customize the success message when reviews are dismissed using
  `on-succeeded-regex-dismiss-review-comment`.
- Fixes [#171](https://github.com/MorrisonCole/pr-lint-action/issues/171): run
  action with Node 16.
- Upgrade dependencies.

### v1.5.1

Internal refactoring only:

- Migrate to Yarn 2.
- Upgrade dependencies.

### v1.5.0

- Reduces action run time from around 40 seconds to 1 second 🔥🚀. We now ship
  the packaged source with Vercel's [ncc](https://github.com/vercel/ncc) and run
  those directly rather than building on the fly with Docker.

### v1.4.2

- Fixes [#155](https://github.com/MorrisonCole/pr-lint-action/issues/155).
  Thanks to @ui-valts-mazurs for reporting _and_ fixing this one!

### v1.4.1

- Fixes [#145](https://github.com/MorrisonCole/pr-lint-action/issues/145)
  (thanks @jnewland! 🤩).

### v1.4.0

- Adds [#119](https://github.com/MorrisonCole/pr-lint-action/issues/119) (thanks
  @bryantbiggs! 🙏) the ability to configure whether changes are requested or
  not with `on-failed-regex-request-changes`. Existing behaviour is preserved.
- Upgrades all dependencies.

### v1.3.0

- Adds [#111](https://github.com/MorrisonCole/pr-lint-action/issues/111), the
  ability to specify whether to create a review and whether to fail the action
  on a regex mismatch independently with `on-failed-regex-fail-action` &
  `on-failed-regex-create-review`.
- `on-failed-regex-comment` is no longer a required input.

_Note:_ existing behaviour from previous releases is preserved without
additional configuration 🙏.

### v1.2.3

Internal refactoring only:

- Upgrade dependencies.
- Move from `lib` to `dist`.
- Address ESLint warnings.

### v1.2.2

- Fixes [#92](https://github.com/MorrisonCole/pr-lint-action/issues/92).

### v1.2.1

- Fixes [#90](https://github.com/MorrisonCole/pr-lint-action/issues/90).

### v1.1.1

Internal refactoring only:

- Upgrade dependencies.
- Configure ESLint & Prettier.

### v1.1.0

- Replaced status checks with an automatic bot review. If the PR title fails to
  match the regex, the bot will request changes. Once the title is edited to
  match it, the bot will dismiss its review.
- Upgrade dependencies.

### v1.0.0

- Initial release. This version uses action status checks but suffers from
  [#5](https://github.com/MorrisonCole/pr-lint-action/issues/5) since the GitHub
  actions API treats different hook types as separate checks by default.

## FAQ

### Why doesn't this Action use status checks any more?

Since actions
[are currently not grouped together](https://github.community/t5/GitHub-Actions/duplicate-checks-on-pull-request-event/m-p/33157),
previously failed status checks were persisted despite newer runs succeeding
(reported in [#5](https://github.com/MorrisonCole/pr-lint-action/issues/5)). We
made the decision to use a bot-based 'request changes' workflow for the time
being.

## Developing

### Build & Package

`yarn install`

`yarn build`

`yarn package`: We package everything to a single file with Vercel's
[ncc](https://github.com/vercel/ncc). Outputs to `dist/index.js`.

### Validate Renovate Config

`npx --package renovate -c renovate-config-validator`

## Related Reading

- [GitHub Action Metadata Syntax](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/metadata-syntax-for-github-actions)
