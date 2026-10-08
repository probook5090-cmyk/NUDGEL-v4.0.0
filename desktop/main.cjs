const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const QRCode = require("qrcode");
const { createPreviewUrl, getLanIPv4 } = require("./network.cjs");

const PREVIEW_PORT = 8081;
const DEV_PROJECT_ROOT = path.resolve(__dirname, "..");
let mainWindow = null;
let previewProcess = null;
let startTask = null;
let projectRoot = null;
let stopping = false;
let startVersion = 0;

const state = {
  status: "checking",
  message: "Preparing your local preview…",
  projectName: "",
  projectRoot: "",
  previewUrl: "",
  qrDataUrl: "",
};

function snapshot() {
  return { ...state };
}

function publishState(patch = {}) {
  Object.assign(state, patch);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("studio:state", snapshot());
}

function readSavedProject() {
  if (!app.isPackaged) return DEV_PROJECT_ROOT;
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "project.json"), "utf8"));
    return typeof saved.projectRoot === "string" ? saved.projectRoot : "";
  } catch {
    return "";
  }
}

function saveProject(projectPath) {
  if (!app.isPackaged) return;
  const configPath = path.join(app.getPath("userData"), "project.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ projectRoot: projectPath }, null, 2));
}

function projectLooksValid(projectPath) {
  if (!projectPath || !fs.existsSync(projectPath)) return false;
  const hasExpoManifest = ["app.json", "app.config.js", "app.config.ts"].some((file) =>
    fs.existsSync(path.join(projectPath, file)),
  );
  return hasExpoManifest && fs.existsSync(path.join(projectPath, "package.json"));
}

function localExpoCli(projectPath) {
  const candidates = [
    path.join(projectPath, "node_modules", "expo", "bin", "cli"),
    path.join(projectPath, "node_modules", "expo", "bin", "cli.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function networkDescription() {
  const address = getLanIPv4(os.networkInterfaces());
  return address ? { address, url: createPreviewUrl(address, PREVIEW_PORT) } : null;
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => server.close(() => resolve(true)));
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(350);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForExpo(port, child, getLaunchError, isCancelled, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (isCancelled()) throw new Error("Preview startup cancelled.");
    if (getLaunchError()) throw getLaunchError();
    if (child.exitCode !== null) throw new Error(`Expo exited with code ${child.exitCode ?? "unknown"}.`);
    if (await canConnect(port)) return;
    await wait(350);
  }
  throw new Error("The web preview did not start in time. Check the selected project's Expo configuration.");
}

function killProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
    killer.on("error", () => child.kill());
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function stopPreview() {
  const child = previewProcess;
  startVersion += 1;
  startTask = null;
  previewProcess = null;
  stopping = true;
  if (!child) {
    stopping = false;
    publishState({ status: projectRoot ? "stopped" : "needs-project", message: "Preview is stopped.", previewUrl: "", qrDataUrl: "" });
    return Promise.resolve(snapshot());
  }

  publishState({ status: "stopping", message: "Stopping the local preview…", previewUrl: "", qrDataUrl: "" });
  killProcessTree(child);
  return new Promise((resolve) => {
    const finish = () => {
      if (stopping) {
        stopping = false;
        publishState({ status: projectRoot ? "stopped" : "needs-project", message: "Preview is stopped." });
      }
      resolve(snapshot());
    };
    const timeout = setTimeout(finish, 1400);
    child.once("exit", () => {
      clearTimeout(timeout);
      finish();
    });
  });
}

async function startPreview() {
  if (previewProcess) return snapshot();
  if (startTask) return startTask;

  const generation = ++startVersion;
  const task = (async () => {
    if (!projectLooksValid(projectRoot)) {
      publishState({
        status: "needs-project",
        message: "Choose an Expo project folder that contains app.json and package.json.",
        projectName: projectRoot ? path.basename(projectRoot) : "No project selected",
        projectRoot: projectRoot ?? "",
        previewUrl: "",
        qrDataUrl: "",
      });
      return snapshot();
    }

    const cliPath = localExpoCli(projectRoot);
    if (!cliPath) {
      publishState({
        status: "setup-needed",
        message: "Dependencies are missing. Run npm ci in the project folder, then restart the preview.",
        projectName: path.basename(projectRoot),
        projectRoot,
        previewUrl: "",
        qrDataUrl: "",
      });
      return snapshot();
    }

    const network = networkDescription();
    if (!network) {
      publishState({
        status: "offline",
        message: "Connect this PC to a private Wi-Fi or Ethernet network shared with your phone.",
        projectName: path.basename(projectRoot),
        projectRoot,
        previewUrl: "",
        qrDataUrl: "",
      });
      return snapshot();
    }

    const portAvailable = await canBindPort(PREVIEW_PORT);
    if (generation !== startVersion) return snapshot();
    if (!portAvailable) {
      publishState({
        status: "port-busy",
        message: `Port ${PREVIEW_PORT} is already in use. Close another Expo preview and try again.`,
        projectName: path.basename(projectRoot),
        projectRoot,
        previewUrl: "",
        qrDataUrl: "",
      });
      return snapshot();
    }

    const nodeBinary = process.env.LUMA_NODE_PATH || "node";
    const url = network.url;
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#15182A", light: "#FFFFFF" },
    });
    if (generation !== startVersion) return snapshot();
    publishState({
      status: "starting",
      message: `Starting the live web preview on ${network.address}:${PREVIEW_PORT}…`,
      projectName: path.basename(projectRoot),
      projectRoot,
      previewUrl: url,
      qrDataUrl,
    });

    const child = spawn(
      nodeBinary,
      [cliPath, "start", "--web", "--host", "lan", "--port", String(PREVIEW_PORT)],
      {
        cwd: projectRoot,
        detached: process.platform !== "win32",
        windowsHide: true,
        env: {
          ...process.env,
          BROWSER: "none",
          EXPO_NO_TELEMETRY: "1",
          EXPO_OFFLINE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    previewProcess = child;
    let launchError = null;

    const onOutput = (chunk) => {
      const line = String(chunk).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0];
      if (line && /error|failed|unable/i.test(line)) {
        publishState({ message: line.slice(0, 180) });
      }
    };
    child.stdout.on("data", onOutput);
    child.stderr.on("data", onOutput);
    child.once("error", (error) => {
      launchError = error;
      if (previewProcess !== child) return;
      previewProcess = null;
      publishState({ status: "error", message: `Could not start Node.js: ${error.message}`, previewUrl: "", qrDataUrl: "" });
    });
    child.once("exit", (code) => {
      if (previewProcess !== child) return;
      previewProcess = null;
      if (!stopping) {
        publishState({
          status: code === 0 ? "stopped" : "error",
          message: code === 0 ? "Preview stopped." : `Expo stopped unexpectedly (exit ${code ?? "unknown"}).`,
          previewUrl: "",
          qrDataUrl: "",
        });
      }
    });

    try {
      await waitForExpo(
        PREVIEW_PORT,
        child,
        () => launchError,
        () => generation !== startVersion,
      );
      if (generation === startVersion && previewProcess === child) {
        publishState({
          status: "ready",
          message: "Ready. Scan this QR code from Luma Link on your phone.",
          projectName: path.basename(projectRoot),
          projectRoot,
          previewUrl: url,
          qrDataUrl,
        });
      }
    } catch (error) {
      if (generation !== startVersion || previewProcess !== child) return snapshot();
      previewProcess = null;
      killProcessTree(child);
      publishState({ status: "error", message: error.message, previewUrl: "", qrDataUrl: "" });
    }
    return snapshot();
  })();
  startTask = task;

  try {
    return await task;
  } finally {
    if (startTask === task) startTask = null;
  }
}

async function chooseProject() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose the Expo project to preview",
    buttonLabel: "Use this project",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return snapshot();

  const selected = path.resolve(result.filePaths[0]);
  if (!projectLooksValid(selected)) {
    publishState({ status: "error", message: "That folder is not an Expo project. Choose a folder with app.json and package.json." });
    return snapshot();
  }
  await stopPreview();
  projectRoot = selected;
  saveProject(projectRoot);
  publishState({ status: "stopped", projectName: path.basename(projectRoot), projectRoot, message: "Project selected. Starting its preview…" });
  return startPreview();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 850,
    minHeight: 650,
    backgroundColor: "#0A0C17",
    title: "Luma Studio",
    icon: path.join(__dirname, "..", "assets", "images", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("studio:get-state", () => snapshot());
ipcMain.handle("studio:start", () => startPreview());
ipcMain.handle("studio:stop", () => stopPreview());
ipcMain.handle("studio:restart", async () => {
  await stopPreview();
  return startPreview();
});
ipcMain.handle("studio:choose-project", () => chooseProject());
ipcMain.handle("studio:copy-url", () => {
  if (!state.previewUrl) return false;
  clipboard.writeText(state.previewUrl);
  return true;
});
ipcMain.handle("studio:open-preview", async () => {
  if (!state.previewUrl) return false;
  await shell.openExternal(state.previewUrl);
  return true;
});

app.whenReady().then(() => {
  projectRoot = readSavedProject();
  if (!app.isPackaged && projectLooksValid(DEV_PROJECT_ROOT)) projectRoot = DEV_PROJECT_ROOT;
  publishState({
    projectName: projectRoot ? path.basename(projectRoot) : "No project selected",
    projectRoot: projectRoot ?? "",
    status: projectRoot ? "starting" : "needs-project",
    message: projectRoot ? "Starting your local preview…" : "Choose the Expo project folder on this PC.",
  });
  createWindow();
  if (projectRoot) void startPreview();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  killProcessTree(previewProcess);
  previewProcess = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
