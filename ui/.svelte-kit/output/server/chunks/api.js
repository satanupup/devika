import { w as writable } from "./index.js";
import { io } from "socket.io-client";
function getItemFromLocalStorage(key, defaultValue) {
  const storedValue = localStorage.getItem(key);
  if (storedValue) {
    return storedValue;
  }
  localStorage.setItem(key, defaultValue);
  return defaultValue;
}
function subscribeAndStore(store, key, defaultValue) {
  store.set(getItemFromLocalStorage(key, defaultValue));
  store.subscribe((value) => {
    localStorage.setItem(key, value);
  });
}
const internet = writable(true);
const messages = writable([]);
const selectedProject = writable("");
const selectedModel = writable("");
const selectedSearchEngine = writable("");
subscribeAndStore(selectedProject, "selectedProject", "select project");
subscribeAndStore(selectedModel, "selectedModel", "select model");
subscribeAndStore(selectedSearchEngine, "selectedSearchEngine", "select search engine");
const projectList = writable([]);
const modelList = writable({});
const searchEngineList = writable([]);
const agentState = writable(null);
const isSending = writable(false);
const tokenUsage = writable(0);
var define_import_meta_env_default = { BASE_URL: "/", MODE: "production", DEV: false, PROD: true, SSR: true };
const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:1337";
    } else {
      return `http://${host}:1337`;
    }
  } else {
    return "http://127.0.0.1:1337";
  }
};
const API_BASE_URL = define_import_meta_env_default.VITE_API_BASE_URL || getApiBaseUrl();
const socket = io(API_BASE_URL, { autoConnect: false });
export {
  API_BASE_URL as A,
  selectedSearchEngine as a,
  selectedModel as b,
  searchEngineList as c,
  messages as d,
  socket as e,
  isSending as f,
  agentState as g,
  internet as i,
  modelList as m,
  projectList as p,
  selectedProject as s,
  tokenUsage as t
};
