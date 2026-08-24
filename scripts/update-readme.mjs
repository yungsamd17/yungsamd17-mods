import { readFile, writeFile } from "fs/promises";

const USER = "yungsamd17";
const README_PATH = "README.md";
const START = "<!-- AUTO-GENERATED:START -->";
const END = "<!-- AUTO-GENERATED:END -->";

const GROUPS = [
  {
    label: "Discord Client Mods",
    description: "Plugins & themes for Vendetta-family clients (ShiggyCord, Kettu, Bunny, Revenge)",
    topics: ["vendetta-plugins", "vendetta", "bunny", "kettu", "shiggycord", "revenge", "discord-client-mod"],
    names: ["vendetta", "shiggycord", "kettu", "bunny", "revenge"],
  },
  {
    label: "BetterDiscord",
    description: "Plugins and themes for BetterDiscord",
    topics: ["betterdiscord", "betterdiscord-plugin", "betterdiscord-theme", "bd-plugin"],
    names: ["betterdiscord"],
  },
  {
    label: "Userscripts",
    description: "Userscripts for Tampermonkey / Violentmonkey / Greasemonkey",
    topics: ["userscript", "userscripts", "tampermonkey", "violentmonkey", "greasemonkey"],
    names: ["userscript"],
  },
  {
    label: "Extensions & Twitch Tools",
    description: "Browser extensions and Twitch-related projects",
    topics: ["chrome-extension", "firefox-extension", "browser-extension", "twitch"],
    names: ["twitch", "extension"],
  },
];

const EXCLUDE = ["yungsamd17"];
const OTHER_LABEL = "Everything Else";

async function fetchAllRepos() {
  const repos = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&sort=pushed`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "readme-updater" } }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

function groupOf(repo) {
  const topics = (repo.topics || []).map((t) => t.toLowerCase());
  const name = repo.name.toLowerCase();
  for (const group of GROUPS) {
    if (topics.some((t) => group.topics.includes(t))) return group.label;
    if (group.names?.some((n) => name.includes(n))) return group.label;
  }
  return OTHER_LABEL;
}

function renderRepoRow(repo) {
  const name = `[${repo.name}](${repo.html_url})`;
  const desc = (repo.description || "_No description_").replace(/\|/g, "\\|");
  const stars = `⭐ ${repo.stargazers_count}`;
  const updated = new Date(repo.pushed_at).toISOString().slice(0, 10);
  return `| ${name} | ${desc} | ${stars} | ${updated} |`;
}

function renderSection(label, description, repos) {
  const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
  return [
    `### ${label}`,
    "",
    description,
    "",
    "| Repository | Description | Stars | Last push |",
    "|---|---|---|---|",
    ...sorted.map(renderRepoRow),
    "",
  ].join("\n");
}

async function main() {
  const readme = await readFile(README_PATH, "utf8");
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("README is missing AUTO-GENERATED markers");
  }

  const all = (await fetchAllRepos()).filter(
    (r) => !r.fork && !r.archived && !EXCLUDE.includes(r.name.toLowerCase())
  );

  const grouped = new Map();
  for (const repo of all) {
    const key = groupOf(repo);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(repo);
  }

  const sections = [];
  for (const group of GROUPS) {
    const repos = grouped.get(group.label);
    if (!repos?.length) continue;
    grouped.delete(group.label);
    sections.push(renderSection(group.label, group.description, repos));
  }

  const rest = grouped.get(OTHER_LABEL);
  if (rest?.length) {
    sections.push(renderSection(OTHER_LABEL, "Everything that doesn't fit a category yet.", rest));
  }

  const generated =
    `${START}\n\n_${all.length} public repos · auto-generated on ${new Date().toISOString().slice(0, 10)}_\n\n` +
    sections.join("\n") +
    `\n${END}`;

  const next = readme.slice(0, startIdx) + generated + readme.slice(endIdx + END.length);
  await writeFile(README_PATH, next);

  console.log(`Updated README with ${all.length} repos across ${grouped.size ? GROUPS.length + 1 : GROUPS.length} sections.`);
  if (next !== readme) process.exit(2);
}

main();
