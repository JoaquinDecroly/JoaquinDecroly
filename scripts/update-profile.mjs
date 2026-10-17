
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

/* ─────────────────────────────────────────────
   REPOSITORIOS
   ───────────────────────────────────────────── */

async function getAllRepos() {
  const repos = [];

  for (let page = 1; page <= 10; page++) {
    const data = await github(
      `/users/${owner}/repos?per_page=100&page=${page}&type=owner&sort=pushed`
    );

    repos.push(...data);

    if (data.length < 100) {
      break;
    }
  }

  const filtered = repos.filter(
    (repo) => !repo.archived && !repo.private
  );

  console.log("\nRepositorios públicos analizados:");

  for (const repo of filtered) {
    console.log(`- ${repo.full_name}`);
  }

  return filtered;
}

/* ─────────────────────────────────────────────
   ICONOS DE LENGUAJES
   Los lenguajes se conservan aunque no tengan
   un icono disponible en Skill Icons.
   ───────────────────────────────────────────── */

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
  Bash: "bash",
  PowerShell: "powershell",
  SQL: "mysql",
  Vue: "vue",
  Svelte: "svelte",
  SCSS: "sass",
  Sass: "sass",
  Less: "less",
  GraphQL: "graphql",
  Lua: "lua",
  R: "r",
  Scala: "scala",
  Perl: "perl",
  Haskell: "haskell",
  Elixir: "elixir",
  Clojure: "clojure",
  Dockerfile: "docker",
  Makefile: "cmake",
  Prisma: "prisma",
  Astro: "astro",
  Markdown: "markdown",
  YAML: "yaml",
};

/* ─────────────────────────────────────────────
   ICONOS DEL ENTORNO
   ───────────────────────────────────────────── */

const toolIconMap = {
  "IntelliJ IDEA": "idea",
  Eclipse: "eclipse",
  "VS Code": "vscode",
  Git: "git",
  GitHub: "github",
  Docker: "docker",
  "GitHub Actions": "githubactions",
  MySQL: "mysql",
  PostgreSQL: "postgres",
  SQLite: "sqlite",
  Maven: "maven",
  Gradle: "gradle",
  "Node.js": "nodejs",
  Spring: "spring",
  JavaFX: "java",
  Bootstrap: "bootstrap",
};

/* ─────────────────────────────────────────────
   LENGUAJES
   ───────────────────────────────────────────── */

async function getLanguages(repo) {
  const repoOwner = repo.owner?.login || owner;

  return github(
    `/repos/${repoOwner}/${repo.name}/languages`
  );
}


async function buildStack(repos) {
  const languageScores = {};
  const languageRepos = {};

  const reposForLanguages = repos.filter(
    (repo) => repo.name.toLowerCase() !== owner.toLowerCase()
  );

  for (const repo of reposForLanguages) {
    try {
      const languages = await getLanguages(repo);
      const entries = Object.entries(languages);
      const repoTotal = entries.reduce(
        (sum, [, bytes]) => sum + bytes,
        0
      );

      if (repoTotal === 0) continue;

      console.log(`\nLenguajes de ${repo.full_name}:`);

      for (const [language, bytes] of entries) {
        const percentage = (bytes / repoTotal) * 100;

        console.log(
          `- ${language}: ${bytes} bytes (${percentage.toFixed(2)} % del repositorio)`
        );

        /*
         * Cada repositorio aporta porcentajes, en lugar de
         * competir según su tamaño absoluto.
         */
        languageScores[language] =
          (languageScores[language] || 0) + percentage;

        languageRepos[language] =
          (languageRepos[language] || 0) + 1;
      }
    } catch (error) {
      console.log(
        `No se pudieron leer los lenguajes de ${repo.full_name}: ${error.message}`
      );
    }
  }

  const languages = Object.entries(languageScores)
    .map(([language, score]) => ({
      language,
      score,
      repositories: languageRepos[language] || 0,
    }))
    .sort((a, b) => b.score - a.score);

  console.log("\nPuntuación equilibrada por lenguaje:");

  for (const item of languages) {
    console.log(
      `- ${item.language}: ${item.score.toFixed(2)} puntos, presente en ${item.repositories} repositorio(s)`
    );
  }

  if (languages.length === 0) {
    return `<p align="center">No hay lenguajes detectados todavía.</p>`;
  }

  /*
   * Conserva lenguajes relevantes sin exigir que superen
   * un porcentaje global dominado por un único repositorio.
   */
  const visibleLanguages = languages.filter(
  (item) => item.score > 0
);

  const icons = [
    ...new Set(
      visibleLanguages
        .filter((item) => languageIconMap[item.language])
        .slice(0, 16)
        .map((item) => languageIconMap[item.language])
    ),
  ];

  const iconSection = icons.length
    ? `<p align="center">
<img src="https://skillicons.dev/icons?i=${icons.join(",")}&perline=8" alt="Iconos de lenguajes detectados"/>
</p>`
    : "";

  const languageNames = visibleLanguages
    .map((item) => item.language)
    .join(" · ");

  const languageSection = languageNames
    ? `<p align="center"><strong>Lenguajes detectados:</strong><br>${languageNames}</p>`
    : "";

  return `${iconSection}\n${languageSection}`;
}

/* ─────────────────────────────────────────────
   ÁRBOL DE REPOSITORIO
   ───────────────────────────────────────────── */

async function getRepoTree(repo) {
  try {
    const repoOwner = repo.owner?.login || owner;

    return await github(
      `/repos/${repoOwner}/${repo.name}/git/trees/${repo.default_branch}?recursive=1`
    );
  } catch (error) {
    console.log(
      `No se pudo inspeccionar ${repo.full_name}: ${error.message}`
    );

    return { tree: [] };
  }
}

function hasFile(tree, names) {
  return tree.some((item) => {
    const path = item.path.toLowerCase();

    return names.some((name) => {
      const target = name.toLowerCase();

      return path === target || path.includes(target);
    });
  });
}

function hasExtension(tree, extension) {
  return tree.some(
    (item) =>
      item.type === "blob" &&
      item.path.toLowerCase().endsWith(extension)
  );
}

/* ─────────────────────────────────────────────
   DETECCIÓN DEL ENTORNO
   ───────────────────────────────────────────── */

async function detectEnvironment(repos) {
  const detected = new Set(["Git", "GitHub"]);

  const reposToInspect = repos
    .filter(
      (repo) => repo.name.toLowerCase() !== owner.toLowerCase()
    )
    .slice(0, 30);

  for (const repo of reposToInspect) {
    const result = await getRepoTree(repo);
    const tree = result.tree || [];

    if (
      hasFile(tree, [".idea"]) ||
      hasExtension(tree, ".iml")
    ) {
      detected.add("IntelliJ IDEA");
    }

    if (hasFile(tree, [".vscode"])) {
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
      hasFile(tree, ["compose.yml"]) ||
      hasFile(tree, ["compose.yaml"])
    ) {
      detected.add("Docker");
    }

    if (hasFile(tree, ["pom.xml"])) {
      detected.add("Maven");
    }

    if (
      hasFile(tree, ["build.gradle"]) ||
      hasFile(tree, ["settings.gradle"]) ||
      hasFile(tree, ["build.gradle.kts"]) ||
      hasFile(tree, ["settings.gradle.kts"])
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

    if (hasFile(tree, [".github/workflows"])) {
      detected.add("GitHub Actions");
    }

    if (hasExtension(tree, ".fxml")) {
      detected.add("JavaFX");
    }

    if (
      hasFile(tree, ["spring-boot"]) ||
      hasFile(tree, ["springframework"]) ||
      hasFile(tree, ["application.properties"]) ||
      hasFile(tree, ["application.yml"]) ||
      hasFile(tree, ["application.yaml"])
    ) {
      detected.add("Spring");
    }

    if (
      hasFile(tree, ["mysql-connector"]) ||
      hasFile(tree, ["mysql-connector-j"]) ||
      hasFile(tree, ["mysql-connector-java"])
    ) {
      detected.add("MySQL");
    }

    if (
      hasFile(tree, ["sqlite"]) ||
      hasFile(tree, [".db"]) ||
      hasFile(tree, [".sqlite"]) ||
      hasFile(tree, [".sqlite3"])
    ) {
      detected.add("SQLite");
    }

    if (
      hasFile(tree, ["postgresql"]) ||
      hasFile(tree, ["postgres"])
    ) {
      detected.add("PostgreSQL");
    }

    if (
      hasFile(tree, ["bootstrap"]) ||
      hasFile(tree, ["bootstrap.min.css"])
    ) {
      detected.add("Bootstrap");
    }
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
    "JavaFX",
    "Spring",
    "MySQL",
    "PostgreSQL",
    "SQLite",
    "Bootstrap",
    "GitHub Actions",
  ];

  return ordered.filter((tool) => detected.has(tool));
}

/* ─────────────────────────────────────────────
   ICONOS DEL ENTORNO
   ───────────────────────────────────────────── */

function buildToolIcons(tools) {
  const icons = tools
    .map((tool) => toolIconMap[tool])
    .filter(Boolean);

  const uniqueIcons = [...new Set(icons)];

  if (uniqueIcons.length === 0) {
    return `<p align="center">Herramientas detectadas automáticamente.</p>`;
  }

  return `<p align="center">
<img src="https://skillicons.dev/icons?i=${uniqueIcons.join(",")}&perline=8" alt="Entorno de desarrollo"/>
</p>`;
}

/* ─────────────────────────────────────────────
   PROYECTOS
   ───────────────────────────────────────────── */

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
  const repoOwner = repo.owner?.login || owner;

  return `<a href="${repo.html_url}">
<img src="https://github-readme-stats.vercel.app/api/pin/?username=${repoOwner}&repo=${repo.name}&theme=transparent&hide_border=true&title_color=60A5FA&text_color=CBD5E1&icon_color=60A5FA" alt="${repo.name}"/>
</a>`;
}

async function buildProjects(repos) {
  const sorted = [...repos]
    .filter(
      (repo) =>
        repo.name.toLowerCase() !== owner.toLowerCase() &&
        !repo.name.toLowerCase().includes("profile")
    )
    .sort(
      (a, b) =>
        calculateProjectScore(b) -
        calculateProjectScore(a)
    );

  const selected = sorted.slice(0, 4);

  console.log(
    "\nProyectos seleccionados:",
    selected.map((repo) => repo.full_name)
  );

  if (selected.length === 0) {
    return `<p align="center">Todavía no hay proyectos públicos disponibles.</p>`;
  }

  return selected.map(projectCard).join("\n\n");
}

/* ─────────────────────────────────────────────
   REEMPLAZAR BLOQUES AUTOMÁTICOS
   ───────────────────────────────────────────── */

function replaceSection(
  content,
  startMarker,
  endMarker,
  replacement
) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);

  if (
    start === -1 ||
    end === -1 ||
    end < start
  ) {
    throw new Error(
      `No se encontraron los marcadores:\n${startMarker}\n${endMarker}`
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

/* ─────────────────────────────────────────────
   MAIN
   ───────────────────────────────────────────── */

async function main() {
  const fs = await import("node:fs/promises");

  console.log(`Analizando GitHub de ${owner}...`);

  const repos = await getAllRepos();

  console.log(`\nRepositorios públicos encontrados: ${repos.length}`);

  console.log("\nAnalizando lenguajes...");
  const stack = await buildStack(repos);

  console.log("\nAnalizando entorno...");
  const tools = await detectEnvironment(repos);
  const environment = buildToolIcons(tools);

  console.log("\nSeleccionando proyectos...");
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

  await fs.writeFile("README.md", readme, "utf8");

  console.log("\nREADME actualizado correctamente.");
  console.log("Entorno detectado:", tools.join(", "));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
