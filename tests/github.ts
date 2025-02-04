async function isOnGithubActions(): Promise<boolean> {
    const { CI, GITHUB_RUN_ID, GITHUB_TOKEN, GH_TOKEN, GITHUB_REPOSITORY } = process.env;

    const TOKEN = GITHUB_TOKEN || GH_TOKEN;

    if (!CI || !GITHUB_RUN_ID || !TOKEN || !GITHUB_REPOSITORY) return false;

    const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'User-Agent': 'Node.js', // GitHub API requires a user agent
            'Accept': 'application/vnd.github.v3+json' // Specify GitHub API version
        }
    });

    if (!response.ok)  return false;

    const data = await response.json();
    return data["status"] === "in_progress";
}

export default isOnGithubActions;