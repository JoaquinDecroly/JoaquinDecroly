
import fs from "node:fs/promises";

const OWNER = process.env.GITHUB_OWNER || "JoaquinDecroly";
const TOKEN = process.env.GITHUB_TOKEN;

const README = "README.md";
const API = "https://api.github.com";
const API_VERSION = "2026-03-10";

if (!TOKEN) {
  throw new Error("Falta GITHUB_TOKEN.");
}

async function github(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": `${OWNER}-profile-updater`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body}`);
  }

  return response.json();
}

async function listRepos() {
  const repos = [];

  for (let page = 1; page <= 10; page++) {
    const batch = await github(
      `/users/${encodeURIComponent(
        OWNER
      )}/repos?per_page=100&page=${page}&type=owner&sort=pushed&direction=desc`
    );

    repos.push(...batch);

    if (batch.length < 100) {
      break;
    }
  }

  return repos;
}

function pathSegments(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function readRepoFile(repo, path) {
  try {
    const data = await github(
      `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(
        repo
      )}/contents/${pathSegments(path)}`
    );

    if (data.type !== "file" || !data.content) {
      return "";
    }

    return Buffer.from(
      data.content.replace(/\n/g, ""),
      "base64"
    ).toString("utf8");
  } catch {
    return "";
  }
}

function hasPath(paths, matcher) {
  return paths.some((path) => matcher.test(path));
}

function hasAny(paths, values) {
  return values.some(
    (value) =>
      paths.includes(value) ||
      paths.some((path) => path.endsWith(`/${value}`))
  );
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

function iconStrip(ids, perLine = 7) {
  if (!ids.length) {
    return "";
  }

  return `<img src="https://skillicons.dev/icons?i=${ids.join(
    ","
  )}&perline=${perLine}"/>`;
}

function replaceBlock(text, name, replacement) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;

  const regex = new RegExp(
    `${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`,
    "m"
  );

  if (!regex.test(text)) {
    throw new Error(
      `No encuentro los marcadores ${start} y ${end} en README.md.`
    );
  }

  return text.replace(regex, replacement);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const allRepos = await listRepos();

  const profileRepo =
    process.env.GITHUB_REPOSITORY?.split("/")[1] || OWNER;

  const repos = allRepos.filter(
    (repo) =>
      !repo.fork &&
      !repo.archived &&
      repo.name !== profileRepo
  );

  if (!repos.length) {
    throw new Error(
      "No se encontraron repositorios públicos válidos."
    );
  }

  const languageTotals = new Map();

  const detectedTools = new Set([
    "Git",
    "GitHub",
  ]);

  /*
   * ==========================================
   * LENGUAJES
   * ==========================================
   */

  for (const repo of repos) {
    const languages = await github(
      `/repos/${encodeURIComponent(
        OWNER
      )}/${encodeURIComponent(repo.name)}/languages`
    );

    for (const [language, bytes] of Object.entries(languages)) {
      languageTotals.set(
        language,
        (languageTotals.get(language) || 0) + bytes
      );
    }
  }

  /*
   * ==========================================
   * HERRAMIENTAS / ENTORNO
   * ==========================================
   *
   * Analizamos los repositorios más recientes.
   * De esta manera el perfil puede crecer sin
   * disparar innecesariamente las peticiones.
   */

  const reposToScan = repos.slice(0, 15);

  for (const repo of reposToScan) {
    let tree;

    try {
      tree = await github(
        `/repos/${encodeURIComponent(
          OWNER
        )}/${encodeURIComponent(
          repo.name
        )}/git/trees/${encodeURIComponent(
          repo.default_branch
        )}?recursive=1`
      );
    } catch {
      continue;
    }

    const paths = (tree.tree || [])
      .filter(
        (item) =>
          item.type === "blob" ||
          item.type === "tree"
      )
      .map((item) =>
        item.path.replaceAll("\\", "/")
      );

    /*
     * IDE
     */

    if (
      hasPath(
        paths,
        /(^|\/)\.idea(\/|$)|\.iml$/i
      )
    ) {
      detectedTools.add("IntelliJ IDEA");
    }

    if (
      hasPath(
        paths,
        /(^|\/)\.vscode(\/|$)/i
      )
    ) {
      detectedTools.add("VS Code");
    }

    if (
      hasAny(paths, [
        ".project",
        ".classpath",
      ]) ||
      hasPath(
        paths,
        /(^|\/)\.settings(\/|$)/i
      )
    ) {
      detectedTools.add("Eclipse");
    }

    /*
     * DOCKER
     */

    if (
      hasPath(
        paths,
        /(^|\/)Dockerfile$/i
      ) ||
      hasPath(
        paths,
        /(^|\/)docker-compose(?:\.ya?ml)?$/i
      )
    ) {
      detectedTools.add("Docker");
    }

    /*
     * GITHUB ACTIONS
     */

    if (
      hasPath(
        paths,
        /(^|\/)\.github\/workflows\//i
      )
    ) {
      detectedTools.add("GitHub Actions");
    }

    /*
     * BUILD TOOLS
     */

    if (
      hasPath(
        paths,
        /(^|\/)pom\.xml$/i
      )
    ) {
      detectedTools.add("Maven");
    }

    if (
      hasPath(
        paths,
        /(^|\/)build\.gradle(?:\.kts)?$/i
      ) ||
      hasPath(
        paths,
        /(^|\/)settings\.gradle(?:\.kts)?$/i
      )
    ) {
      detectedTools.add("Gradle");
    }

    /*
     * NODE
     */

    if (
      hasAny(paths, [
        "package.json",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
      ])
    ) {
      detectedTools.add("Node.js");
    }

    /*
     * JAVAFX
     */

    if (
      hasPath(
        paths,
        /(^|\/).+\.fxml$/i
      )
    ) {
      detectedTools.add("JavaFX");
    }

    /*
     * SERVLET / JSP
     */

    if (
      hasPath(
        paths,
        /(^|\/).+\.jsp$/i
      ) &&
      hasPath(
        paths,
        /(^|\/).+\.java$/i
      )
    ) {
      detectedTools.add("Servlet/JSP");
    }

    /*
     * SQL
     */

    if (
      hasPath(
        paths,
        /(^|\/).+\.sql$/i
      )
    ) {
      detectedTools.add("MySQL");
    }

    /*
     * MANIFESTS
     */

    const manifests = [
      "pom.xml",
      "package.json",
      "composer.json",
      "build.gradle",
      "build.gradle.kts",
    ];

    const existingManifests = manifests.filter(
      (manifest) =>
        paths.some(
          (path) =>
            path.toLowerCase() ===
            manifest.toLowerCase()
        )
    );

    for (const manifest of existingManifests.slice(0, 2)) {
      const content = await readRepoFile(
        repo.name,
        manifest
      );

      const lower = content.toLowerCase();

      if (
        lower.includes("spring-boot") ||
        lower.includes(
          "org.springframework.boot"
        )
      ) {
        detectedTools.add("Spring");
      }

      if (lower.includes("bootstrap")) {
        detectedTools.add("Bootstrap");
      }

      if (
        lower.includes("mysql-connector") ||
        lower.includes("mysql2")
      ) {
        detectedTools.add("MySQL");
      }

      if (
        lower.includes("javafx") ||
        lower.includes("org.openjfx")
      ) {
        detectedTools.add("JavaFX");
      }
    }
  }

  /*
   * ==========================================
   * ORDENAR LENGUAJES
   * ==========================================
   */

  const sortedLanguages = [
    ...languageTotals.entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .map(([language]) => language);

  const knownLanguageIds = sortedLanguages
    .map(
      (language) =>
        languageIconMap[language]
    )
    .filter(Boolean)
    .filter(
      (id, index, array) =>
        array.indexOf(id) === index
    )
    .slice(0, 14);

  const unknownLanguages =
    sortedLanguages.filter(
      (language) =>
        !languageIconMap[language]
    );

  /*
   * ==========================================
   * ICONOS DE ENTORNO
   * ==========================================
   */

  const knownToolIds = [
    ...detectedTools,
  ]
    .map(
      (tool) =>
        toolIconMap[tool]
    )
    .filter(Boolean)
    .filter(
      (id, index, array) =>
        array.indexOf(id) === index
    );

  const unknownTools = [
    ...detectedTools,
  ].filter(
    (tool) =>
      !toolIconMap[tool]
  );

  /*
   * ==========================================
   * GENERAR STACK
   * ==========================================
   */

  const stackBlock = [
    "<!-- AUTO-STACK:START -->",
    "<div align=\"center\">",
    "",
    iconStrip(
      knownLanguageIds,
      7
    ),
    "",
    `<strong>Lenguajes detectados:</strong> ${
      sortedLanguages
        .slice(0, 12)
        .map(
          (language) =>
            `\`${language}\``
        )
        .join(" · ") ||
      "Sin datos"
    }`,
    unknownLanguages.length
      ? `<br><sub>Otros lenguajes detectados: ${unknownLanguages
          .slice(0, 6)
          .join(" · ")}</sub>`
      : "",
    "",
    "</div>",
    "<!-- AUTO-STACK:END -->",
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * ==========================================
   * GENERAR ENTORNO
   * ==========================================
   */

  const envBlock = [
    "<!-- AUTO-ENV:START -->",
    "<div align=\"center\">",
    "",
    iconStrip(
      knownToolIds,
      7
    ),
    "",
    `<strong>Detectado en mis repositorios:</strong> ${[
      ...detectedTools,
    ].join(" · ")}`,
    unknownTools.length
      ? `<br><sub>Detectado pero sin icono disponible: ${unknownTools.join(
          " · "
        )}</sub>`
      : "",
    "",
    "</div>",
    "<!-- AUTO-ENV:END -->",
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * ==========================================
   * ACTUALIZAR README
   * ==========================================
   */

  let readme = await fs.readFile(
    README,
    "utf8"
  );

  readme = replaceBlock(
    readme,
    "AUTO-STACK",
    stackBlock
  );

  readme = replaceBlock(
    readme,
    "AUTO-ENV",
    envBlock
  );

  await fs.writeFile(
    README,
    readme,
    "utf8"
  );

  console.log(
    `Repositorios analizados: ${repos.length}`
  );

  console.log(
    `Lenguajes detectados: ${sortedLanguages.join(
      ", "
    )}`
  );

  console.log(
    `Entorno detectado: ${[
      ...detectedTools,
    ].join(", ")}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
