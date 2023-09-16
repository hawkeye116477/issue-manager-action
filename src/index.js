import { getInput, setFailed } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { parse as loadYaml } from 'yaml';

async function run() {
    try {
        const token = getInput("repo-token");
        const configPath = getInput("configuration-path");
        const labels = context.payload.issue.labels;
        const octokit = getOctokit(token);

        const mode = getInput("mode");
        if (mode == "labelOpened") {
            if (configPath) {
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
                                console.log(`Removing "${label}" label from issue #${context.issue.number} ...`);
                                octokit.rest.issues.removeLabel({
                                    issue_number: context.issue.number,
                                    owner: context.repo.owner,
                                    repo: context.repo.repo,
                                    name: label
                                })
                            }
                        }
                        if (labelsToAdd.length > 0) {
                            let labelSingleOrNot = "label"
                            if (labelsToAdd.length > 1) {
                                labelSingleOrNot = "labels"
                            }
                            console.log(`Adding "${labelsToAdd.join(", ")}" ${labelSingleOrNot} to issue #${context.issue.number} ...`);
                            octokit.rest.issues.addLabels({
                                issue_number: context.issue.number,
                                owner: context.repo.owner,
                                repo: context.repo.repo,
                                labels: labelsToAdd
                            })
                        }
                    }
                }
            }
        }
        else if (mode == "close" || mode == "labelClosed") {
            const completedLabel = getInput("completed-label").trim().split("\n");
            const notPlannedLabel = getInput("not-planned-label").trim().split("\n");
            if (completedLabel && notPlannedLabel) {
                if (mode == "close") {
                    if (labels.some(e => completedLabel.includes(e.name)) || labels.some(e => notPlannedLabel.includes(e.name))) {
                        let reason;
                        if (labels.some(e => completedLabel.includes(e.name))) {
                            reason = "completed"
                        }
                        else if (labels.some(e => notPlannedLabel.includes(e.name))) {
                            reason = "not_planned"
                        }
                        console.log(`Closing issue #${context.issue.number} ...`);
                        octokit.rest.issues.update({
                            owner: context.repo.owner,
                            repo: context.repo.repo,
                            issue_number: context.issue.number,
                            state: "closed",
                            state_reason: reason
                        })
                    }
                }
                else {
                    const reason = context.payload.issue.state_reason;
                    let labelsToAdd = [];
                    if (reason === "completed" && !labels.some(e => completedLabel.includes(e.name))) {
                        labelsToAdd = completedLabel
                    }
                    else if (reason === "not_planned" && !labels.some(e => notPlannedLabel.includes(e.name))) {
                        labelsToAdd = notPlannedLabel
                    }
                    let labelSingleOrNot = "label"
                    if (labelsToAdd.length > 1) {
                        labelSingleOrNot = "labels"
                    }
                    console.log(`Adding "${labelsToAdd.join(", ")}" ${labelSingleOrNot} to issue #${context.issue.number} ...`);
                    octokit.rest.issues.addLabels({
                        issue_number: context.issue.number,
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        labels: labelsToAdd
                    })
                }
            }
        }
        else {
            throw new Error(
                "Invalid task."
            );
        }

    } catch (error) {
        setFailed(error.message);
    }
}

run();
