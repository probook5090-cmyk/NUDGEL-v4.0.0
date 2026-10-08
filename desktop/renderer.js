const bridge = window.lumaStudio;
const statusElement = document.getElementById("status");
const pathElement = document.getElementById("project-path");
const urlElement = document.getElementById("preview-url");
const qrElement = document.getElementById("qr-image");
const placeholderElement = document.getElementById("qr-placeholder");
const hintElement = document.getElementById("hint");
const copyButton = document.getElementById("copy-link");
const openButton = document.getElementById("open-preview");
const stopButton = document.getElementById("stop");

const statusLabels = {
  checking: "Checking…",
  starting: "Starting…",
  ready: "Live · Ready",
  stopped: "Stopped",
  stopping: "Stopping…",
  "needs-project": "Choose a project",
  "setup-needed": "Install dependencies",
  offline: "Not on Wi-Fi",
  "port-busy": "Port in use",
  error: "Needs attention",
};

function render(state) {
  const ready = state.status === "ready";
  statusElement.textContent = statusLabels[state.status] || state.status || "Waiting";
  statusElement.className = `status${ready ? " ready" : state.status === "error" || state.status === "port-busy" ? " error" : ""}`;
  pathElement.textContent = state.projectName ? `${state.projectName} · ${state.projectRoot}` : "No project selected";
  pathElement.title = state.projectRoot || "";
  urlElement.textContent = state.previewUrl || state.message || "Waiting for the local server…";
  qrElement.src = state.qrDataUrl || "";
  qrElement.classList.toggle("visible", Boolean(state.qrDataUrl));
  placeholderElement.classList.toggle("hidden", Boolean(state.qrDataUrl));
  copyButton.disabled = !state.previewUrl;
  openButton.disabled = !state.previewUrl;
  stopButton.disabled = state.status === "stopped" || state.status === "needs-project";
  hintElement.textContent = state.message || "Edits will hot-reload while the preview is connected.";
}

bridge.onState(render);
bridge.getState().then(render);

document.getElementById("choose-project").addEventListener("click", () => bridge.chooseProject());
document.getElementById("copy-link").addEventListener("click", async () => {
  const copied = await bridge.copyUrl();
  if (copied) {
    copyButton.textContent = "Copied";
    setTimeout(() => { copyButton.textContent = "Copy link"; }, 1300);
  }
});
document.getElementById("open-preview").addEventListener("click", () => bridge.openPreview());
document.getElementById("restart").addEventListener("click", () => bridge.restart());
document.getElementById("stop").addEventListener("click", () => bridge.stop());
