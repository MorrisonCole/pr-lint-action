# Pull Request Linter

A GitHub Action to ensure that your PR title matches a given regex.

## Usage

Create a workflow definition at `.github/workflows/<my-workflow>.yml` with something like the following contents:

```yaml
name: PR Lint

on:
  pull_request:
    types: [opened, edited, reopened]

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
