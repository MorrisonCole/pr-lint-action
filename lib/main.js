"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const github_1 = require("@actions/github/lib/github");
const core = require('@actions/core');
const github = require('@actions/github');
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const githubContext = github.context;
        const githubToken = core.getInput('repo-token');
        const githubClient = new github_1.GitHub(githubToken);
        const titleRegex = new RegExp(core.getInput('title-regex'));
        const title = githubContext.payload.pull_request.title;
        const onFailedRegexComment = core.getInput('on-failed-regex-comment')
            .replace('%pattern%', titleRegex.source);
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
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
// noinspection JSIgnoredPromiseFromCall
run();
