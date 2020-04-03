# Pull Request Linter

A GitHub Action to ensure that your PR title matches a given regex.

## Usage

Create a workflow definition at `.github/workflows/<my-workflow>.yml` with something like the following contents:

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
    - uses: morrisoncole/pr-lint-action@v1.0.0
      with:
        title-regex: "#EX-[0-9]+"
        on-failed-regex-comment: "This is just an example. Failed regex: `%regex%`!"
        repo-token: "${{ secrets.GITHUB_TOKEN }}"

```

## Related Reading

* [GitHub Action Metadata Syntax](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/metadata-syntax-for-github-actions)
