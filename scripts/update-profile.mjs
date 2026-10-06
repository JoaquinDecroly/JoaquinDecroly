const API = "https://api.github.com";

const owner = process.env.GITHUB_OWNER || "JoaquinDecroly";
const token = process.env.GITHUB_TOKEN;

if (!token) {
throw new Error("Falta GITHUB_TOKEN");
}

const headers = {
Accept: "application/vnd.github+json",
Authorization: `Bearer ${token}`,
"X-GitHub-Api-Version": "2022-11-28",
};

async function github(path) {
const response = await fetch(`${API}${path}`, { headers });

if (!response.ok) {
const body = await response.text();
throw new Error(`GitHub API ${response.status}: ${body}`);
}

return response.json();
}

async function getAllRepos() {
const repos = [];

for (let page = 1; page <= 10; page++) {
const data = await github(
`/users/${owner}/repos?per_page=100&page=${page}&type=owner&sort=pushed`
);

```
repos.push(...data);

if (data.length < 100) {
  break;
}
```

}

return repos.filter(
repo =>
!repo.fork &&
!repo.archived &&
!repo.private
);
}

function escapeHtml(value = "") {
return value
.replaceAll("&", "&")
.replaceAll("<", "<")
.replaceAll(">", ">")
.replaceAll('"', """);
}

const languageIconMap = {
JavaScript: "js",
TypeScript: "ts",
HTML: "html",
CSS: "css",
Java: "java",
PHP: "php",
Python: "python",
C: "c",
"C++": "cpp",
"C#": "cs",
Kotlin: "kotlin",
Swift: "swift",
Go: "go",
Rust: "rust",
Ruby: "ruby",
Dart: "dart",
Shell: "bash",
SQL: "mysql",
};

const toolIconMap = {
"IntelliJ IDEA": "idea",
Eclipse: "eclipse",
"VS Code": "vscode",
Git: "git",
GitHub: "github",
Docker: "docker",
"GitHub Actions": "githubactions",
MySQL: "mysql",
PostgreSQL: "postgresql",
SQLite: "sqlite",
Maven: "maven",
Gradle: "gradle",
"Node.js": "nodejs",
Spring: "spring",
Bootstrap: "bootstrap",
};

async function getLanguages(repo) {
return github(`/repos/${owner}/${repo.name}/languages`);
}

async function getRepoTree(repo) {
try {
return await github(
`/repos/${owner}/${repo.name}/git/trees/${repo.default_branch}?recursive=1`
);
} catch {
return { tree: [] };
}
}

function calculateProjectScore(repo) {
const daysSincePush =
(Date.now() - new Date(repo.pushed_at).getTime()) /
(1000 * 60 * 60 * 24);

const recencyScore = Math.max(0, 100 - daysSincePush);

const starsScore = repo.stargazers_count * 10;
const forksScore = repo.forks_count * 5;

const sizeScore = Math.min(repo.size / 100, 20);

return (
recencyScore +
starsScore +
forksScore +
sizeScore
);
}

function projectCard(repo) {
return `<a href="${repo.html_url}"> <img src="https://github-readme-stats.vercel.app/api/pin/?username=${owner}&repo=${repo.name}&theme=transparent&hide_border=true&title_color=60A5FA&text_color=CBD5E1&icon_color=60A5FA"/> </a>`;
}

async function buildProjects(repos) {
const sorted = [...repos]
.filter(repo => !repo.name.toLowerCase().includes("profile"))
.sort((a, b) => {
return calculateProjectScore(b) - calculateProjectScore(a);
});

const selected = sorted.slice(0, 4);

if (selected.length === 0) {
return `<p align="center">Todavía no hay proyectos públicos disponibles.</p>`;
}

return selected
.map(projectCard)
.join("\n\n");
}

async function buildStack(repos) {
const languageTotals = {};

for (const repo of repos) {
try {
const languages = await getLanguages(repo);

```
  for (const [language, bytes] of Object.entries(languages)) {
    languageTotals[language] =
      (languageTotals[language] || 0) + bytes;
  }
} catch (error) {
  console.log(`No se pudieron leer lenguajes de ${repo.name}`);
}
```

}

const languages = Object.entries(languageTotals)
.sort((a, b) => b[1] - a[1])
.map(([language]) => language)
.filter(language => languageIconMap[language])
.slice(0, 10);

if (languages.length === 0) {
return `<p align="center">No hay lenguajes detectados todavía.</p>`;
}

const icons = languages
.map(language => languageIconMap[language])
.join(",");

return `<p align="center"> <img src="https://skillicons.dev/icons?i=${icons}&perline=8" alt="Tecnologías detectadas"/>

</p>`;
}

function hasFile(tree, names) {
return tree.some(item => {
if (item.type !== "blob") return false;

```
const path = item.path.toLowerCase();

return names.some(name =>
  path.endsWith(name.toLowerCase()) ||
  path.includes(name.toLowerCase())
);
```

});
}

function hasExtension(tree, extension) {
return tree.some(item =>
item.type === "blob" &&
item.path.toLowerCase().endsWith(extension)
);
}

async function detectEnvironment(repos) {
const detected = new Set();

detected.add("Git");
detected.add("GitHub");

const reposToInspect = repos.slice(0, 20);

for (const repo of reposToInspect) {
const result = await getRepoTree(repo);
const tree = result.tree || [];

```
if (
  hasFile(tree, [".idea"]) ||
  hasExtension(tree, ".iml")
) {
  detected.add("IntelliJ IDEA");
}

if (
  hasFile(tree, [".vscode"])
) {
  detected.add("VS Code");
}

if (
  hasFile(tree, [".project"]) ||
  hasFile(tree, [".classpath"]) ||
  hasFile(tree, [".settings"])
) {
  detected.add("Eclipse");
}

if (
  hasFile(tree, ["dockerfile"]) ||
  hasFile(tree, ["docker-compose.yml"]) ||
  hasFile(tree, ["compose.yml"])
) {
  detected.add("Docker");
}

if (
  hasFile(tree, ["pom.xml"])
) {
  detected.add("Maven");
}

if (
  hasFile(tree, ["build.gradle"]) ||
  hasFile(tree, ["settings.gradle"]) ||
  hasFile(tree, ["build.gradle.kts"])
) {
  detected.add("Gradle");
}

if (
  hasFile(tree, ["package.json"]) ||
  hasFile(tree, ["package-lock.json"]) ||
  hasFile(tree, ["yarn.lock"]) ||
  hasFile(tree, ["pnpm-lock.yaml"])
) {
  detected.add("Node.js");
}

if (
  hasFile(tree, [".github/workflows"])
) {
  detected.add("GitHub Actions");
}

if (
  hasExtension(tree, ".fxml")
) {
  detected.add("JavaFX");
}

if (
  hasExtension(tree, ".jsp") ||
  hasExtension(tree, ".java")
) {
  detected.add("Eclipse");
}

if (
  hasExtension(tree, ".sql")
) {
  detected.add("MySQL");
}
```

}

const ordered = [
"Git",
"GitHub",
"IntelliJ IDEA",
"Eclipse",
"VS Code",
"Docker",
"Maven",
"Gradle",
"Node.js",
"Spring",
"MySQL",
"GitHub Actions",
];

return ordered.filter(tool => detected.has(tool));
}

function buildToolIcons(tools) {
const icons = tools
.map(tool => toolIconMap[tool])
.filter(Boolean);

if (icons.length === 0) {
return `<p align="center">Herramientas detectadas automáticamente.</p>`;
}

return `<p align="center">
<img src="https://skillicons.dev/icons?i=${icons.join(",")}&perline=8" alt="Entorno de desarrollo"/>

</p>`;
}

function replaceSection(content, startMarker, endMarker, replacement) {
const start = content.indexOf(startMarker);
const end = content.indexOf(endMarker);

if (start === -1 || end === -1 || end < start) {
throw new Error(
`No se encontraron los marcadores ${startMarker} / ${endMarker}`
);
}

const startContent = start + startMarker.length;

return (
content.slice(0, startContent) +
"\n" +
replacement +
"\n" +
content.slice(end)
);
}

async function main() {
const fs = await import("node:fs/promises");

console.log("Buscando repositorios...");

const repos = await getAllRepos();

console.log(`Repositorios encontrados: ${repos.length}`);

console.log("Analizando lenguajes...");
const stack = await buildStack(repos);

console.log("Analizando entorno...");
const tools = await detectEnvironment(repos);
const environment = buildToolIcons(tools);

console.log("Seleccionando proyectos...");
const projects = await buildProjects(repos);

let readme = await fs.readFile("README.md", "utf8");

readme = replaceSection(
readme,
"<!-- AUTO-STACK:START -->",
"<!-- AUTO-STACK:END -->",
stack
);

readme = replaceSection(
readme,
"<!-- AUTO-ENV:START -->",
"<!-- AUTO-ENV:END -->",
environment
);

readme = replaceSection(
readme,
"<!-- AUTO-PROJECTS:START -->",
"<!-- AUTO-PROJECTS:END -->",
projects
);

await fs.writeFile("README.md", readme);

console.log("README actualizado correctamente.");

console.log("Stack:", stack);
console.log("Entorno:", tools);
console.log(
"Proyectos:",
repos
.filter(repo => !repo.name.toLowerCase().includes("profile"))
.sort(
(a, b) =>
calculateProjectScore(b) -
calculateProjectScore(a)
)
.slice(0, 4)
.map(repo => repo.name)
);
}

main().catch(error => {
console.error(error);
process.exit(1);
});
