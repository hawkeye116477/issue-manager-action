import { getInput, setFailed } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { load as loadYaml } from 'js-yaml';

async function run() {
    try {
        const token = getInput("repo-token");
        const octokit = getOctokit(token);
        const configPath = getInput("configuration-path");
        const { data } = await octokit.rest.repos.getContent({
            owner: context.repo.owner,
            repo: context.repo.repo,
            ref: context.sha,
            path: configPath,
        });
        if (!("content" in data)) {
            throw new TypeError(
                "The configuration path provided is not a valid file. Exiting"
            );
        }
        const configContent = Buffer.from(data.content, "base64").toString("utf8");
        const yamlConfig = loadYaml(configContent);
        const labels = context.payload.issue.labels;

        let labelsToAdd = [];

        if (typeof yamlConfig != "undefined") {
            const body = context.payload.issue.body;
            if (body) {
                for (const [label, bodyRegex] of Object.entries(yamlConfig)) {
                    var re_add = new RegExp(`- \\[[xX]] ${bodyRegex}`, "i");
                    var re_remove = new RegExp(`- \\[[ ]] ${bodyRegex}`, "i");
                    if (body.match(re_add) && !labels.some(e => e.name === label)) {
                        labelsToAdd.push(label);
                    }
                    if (body.match(re_remove) && labels.some(e => e.name === label)) {
                        octokit.rest.issues.removeLabel({
                            issue_number: context.issue.number,
                            owner: context.repo.owner,
                            repo: context.repo.repo,
                            name: label
                        })
                    }
                }
                if (labelsToAdd.length > 0) {
                    octokit.rest.issues.addLabels({
                        issue_number: context.issue.number,
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        labels: labelsToAdd
                    })
                }
            }
        }

        const completedLabel = getInput("completed-label");
        const notPlannedLabel = getInput("not-planned-label")
        if (completedLabel && notPlannedLabel) {
            if (labels.some(e => e.name === completedLabel) || labels.some(e => e.name === notPlannedLabel)) {
                let reason;
                if (labels.some(e => e.name === completedLabel)) {
                    reason = "completed"
                }
                else if (labels.some(e => e.name === notPlannedLabel)) {
                    reason = "not_planned"
                }
                octokit.rest.issues.update({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    issue_number: context.issue.number,
                    state: "closed",
                    state_reason: reason
                })
            }
        }
    } catch (error) {
        setFailed(error.message);
    }
}

run();
