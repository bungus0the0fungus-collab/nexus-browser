"use strict";

const form = document.getElementById("addressForm");
const address = document.getElementById("address");
const searchEngine = document.getElementById("sj-search-engine");
const homeSearch = document.getElementById("homeSearch");
const homeSearchInput = document.getElementById("homeSearchInput");
const tabsElement = document.getElementById("tabs");
const homePage = document.getElementById("homePage");
const browserStage = document.getElementById("browserStage");
const errorPanel = document.getElementById("errorPanel");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
const statusText = document.getElementById("statusText");
const connectionDot = document.getElementById("connectionDot");

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js"
  }
});

scramjet.init();

const scramjetReady = scramjet.wait();
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

const tabs = [];
let activeTabId = null;
let nextTabId = 1;
let proxyReadyPromise = null;

function setStatus(message, online = true) {
  statusText.textContent = message;
  connectionDot.classList.toggle("offline", !online);
}

function currentTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function renderTabs() {
  tabsElement.replaceChildren();

  for (const tab of tabs) {
    const tabElement = document.createElement("div");
    tabElement.className = "tab" + (tab.id === activeTabId ? " active" : "");

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "tab-select";
    selectButton.textContent = tab.title;
    selectButton.title = tab.url || "Nexus home";
    selectButton.addEventListener("click", () => activateTab(tab.id));

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "tab-close";
    closeButton.textContent = "×";
    closeButton.title = "Close tab";
    closeButton.setAttribute("aria-label", "Close " + tab.title);
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });

    tabElement.append(selectButton, closeButton);
    tabsElement.append(tabElement);
  }
}

function showActiveView() {
  const tab = currentTab();

  if (!tab) {
    homePage.hidden = false;
    browserStage.hidden = true;
    errorPanel.hidden = true;
    address.value = "";
    return;
  }

  homePage.hidden = !tab.isHome;
  browserStage.hidden = tab.isHome || !tab.frame;
  errorPanel.hidden = true;
  address.value = tab.url || "";

  for (const item of tabs) {
    if (item.frame && item.frame.frame) {
      item.frame.frame.style.display =
        item.id === activeTabId && !tab.isHome ? "block" : "none";
    }
  }

  document.getElementById("back").disabled = !tab.frame;
  document.getElementById("forward").disabled = !tab.frame;
}

function activateTab(id) {
  activeTabId = id;
  renderTabs();
  showActiveView();

  const tab = currentTab();
  setStatus(tab && tab.url ? "Viewing " + tab.title : "Nexus is ready");
}

function createTab() {
  const tab = {
    id: nextTabId++,
    title: "New tab",
    url: "",
    history: [],
    historyIndex: -1,
    isHome: true,
    frame: null
  };

  tabs.push(tab);
  activeTabId = tab.id;
  renderTabs();
  showActiveView();
  setStatus("New tab");
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;

  const tab = tabs[index];

  if (tab.frame && tab.frame.frame) {
    tab.frame.frame.remove();
  }

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createTab();
    return;
  }

  if (activeTabId === id) {
    activeTabId = tabs[Math.max(0, index - 1)].id;
  }

  renderTabs();
  showActiveView();
  setStatus("Tab closed");
}

function showError(title, message) {
  homePage.hidden = true;
  browserStage.hidden = true;
  errorPanel.hidden = false;
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  setStatus("Could not open page", false);
}

async function prepareProxy() {
  if (!proxyReadyPromise) {
    proxyReadyPromise = (async () => {
      await registerSW();
      await scramjetReady;

      const wispUrl =
        (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/wisp/";

      if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
        await connection.setTransport("/libcurl/index.mjs", [
          { websocket: wispUrl }
        ]);
      }
    })();
  }

  try {
    await proxyReadyPromise;
  } catch (error) {
    proxyReadyPromise = null;
    throw error;
  }
}

function ensureFrame(tab) {
  if (tab.frame) return tab.frame;

  const frame = scramjet.createFrame();
  frame.frame.id = "nexus-frame-" + tab.id;
  frame.frame.className = "scram-frame";
  frame.frame.title = "Nexus website: " + tab.title;
  frame.frame.setAttribute(
    "allow",
    "autoplay; fullscreen; encrypted-media; picture-in-picture"
  );

  frame.frame.addEventListener("load", () => {
    if (activeTabId === tab.id) {
      setStatus("Page loaded: " + tab.title);
    }
  });

  browserStage.append(frame.frame);
  tab.frame = frame;
  return frame;
}

function resolveAddress(input) {
  const value = input.trim();

  if (!value) return null;

  const result = search(value, searchEngine.value);

  let parsed;
  try {
    parsed = new URL(result);
  } catch {
    throw new Error("That address or search could not be understood.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Nexus currently supports HTTP and HTTPS websites.");
  }

  return parsed.href;
}

async function navigate(input, addToHistory = true) {
  const tab = currentTab();
  if (!tab) return;

  let url;

  try {
    url = resolveAddress(input);
    if (!url) return;
  } catch (error) {
    showError("Invalid address", error.message);
    return;
  }

  tab.url = url;
  tab.title = getHostLabel(url);
  tab.isHome = false;

  if (addToHistory) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
  }

  renderTabs();
  showActiveView();
  address.value = url;
  setStatus("Connecting to " + tab.title + "...");

  try {
    await prepareProxy();

    const frame = ensureFrame(tab);
    showActiveView();

    await frame.go(url);

    if (activeTabId === tab.id) {
      setStatus("Loading " + tab.title + "...");
    }
  } catch (error) {
    console.error("Nexus navigation failed:", error);
    if (activeTabId === tab.id) {
      showError(
        "Proxy connection failed",
        error && error.message
          ? error.message
          : "Nexus could not initialize Scramjet. Refresh and try again."
      );
    }
  }
}

function getHostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "Website";
  }
}

function showHome() {
  const tab = currentTab();
  if (!tab) return;

  tab.isHome = true;
  tab.title = "New tab";
  tab.url = "";

  renderTabs();
  showActiveView();
  setStatus("Nexus is ready");
}

function goBack() {
  const tab = currentTab();
  if (!tab || !tab.frame) return;

  try {
    const frameWindow = tab.frame.frame.contentWindow;
    if (frameWindow && frameWindow.history.length > 1) {
      frameWindow.history.back();
      setStatus("Going back...");
      return;
    }
  } catch (error) {
    console.warn("Frame history is unavailable:", error);
  }

  if (tab.historyIndex > 0) {
    tab.historyIndex--;
    navigate(tab.history[tab.historyIndex], false);
  }
}

function goForward() {
  const tab = currentTab();
  if (!tab || !tab.frame) return;

  try {
    const frameWindow = tab.frame.frame.contentWindow;
    if (frameWindow && frameWindow.history.length > 1) {
      frameWindow.history.forward();
      setStatus("Going forward...");
      return;
    }
  } catch (error) {
    console.warn("Frame history is unavailable:", error);
  }

  if (tab.historyIndex < tab.history.length - 1) {
    tab.historyIndex++;
    navigate(tab.history[tab.historyIndex], false);
  }
}

function refreshPage() {
  const tab = currentTab();
  if (!tab || tab.isHome || !tab.frame) return;

  try {
    tab.frame.frame.contentWindow.location.reload();
    setStatus("Refreshing " + tab.title + "...");
  } catch {
    navigate(tab.url, false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  navigate(address.value);
});

homeSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  navigate(homeSearchInput.value);
});

document.getElementById("newTab").addEventListener("click", createTab);
document.getElementById("back").addEventListener("click", goBack);
document.getElementById("forward").addEventListener("click", goForward);
document.getElementById("refresh").addEventListener("click", refreshPage);
document.getElementById("home").addEventListener("click", showHome);
document.getElementById("brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});

document.querySelectorAll(".quick-link").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.url) navigate(button.dataset.url);
  });
});

document.getElementById("retry").addEventListener("click", () => {
  const tab = currentTab();
  if (tab && tab.url) navigate(tab.url, false);
  else showHome();
});

document.getElementById("errorHome").addEventListener("click", showHome);

document.getElementById("fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.getElementById("app").requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    setStatus("Fullscreen is unavailable in this browser", false);
  }
});

document.addEventListener("keydown", (event) => {
  const modifier = event.ctrlKey || event.metaKey;

  if (modifier && event.key.toLowerCase() === "l") {
    event.preventDefault();
    address.focus();
    address.select();
  }

  if (modifier && event.key.toLowerCase() === "t") {
    event.preventDefault();
    createTab();
  }

  if (modifier && event.key.toLowerCase() === "w") {
    event.preventDefault();
    closeTab(activeTabId);
  }
});

// Start with one clean Nexus home tab.
createTab();
