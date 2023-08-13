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
        const body = context.payload.issue.body;
        const labels = context.payload.issue.labels;

        let labelsToAdd = [];

        if (body) {
            if (typeof yamlConfig.labels != "undefined") {
                for (const [label, bodyRegex] of Object.entries(yamlConfig.labels)) {
                    console.log(`${label}: ${bodyRegex}`);
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

    } catch (error) {
        setFailed(error.message);
    }
}

run();
