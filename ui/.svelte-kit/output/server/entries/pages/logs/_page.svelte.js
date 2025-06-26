import { c as create_ssr_component, d as each, e as escape, a as add_attribute } from "../../../chunks/ssr.js";
import "../../../chunks/api.js";
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let logs = [];
  let socket_logs = [];
  const logColors = {
    "ERROR": "text-red-500",
    "EXCEPT": "text-red-500",
    "WARNING": "text-yellow-500",
    "INFO": "text-blue-500",
    "DEBUG": "text-gray-500"
  };
  function getTextColor(log) {
    for (const key in logColors) {
      if (log.includes(key)) {
        return logColors[key];
      }
    }
    return "";
  }
  return `<div class="p-4 h-full gap-8 flex flex-col overflow-x-clip"><h1 class="text-3xl" data-svelte-h="svelte-zp7iil">Logs</h1> <div class="flex gap-4 overflow-y-auto"><div class="flex flex-col gap-4 w-1/2"><h1 class="text-2xl" data-svelte-h="svelte-3dwtt9">Request logs</h1> <div class="flex flex-col gap-2">${each(logs, (log) => {
    return `<p class="${"whitespace-normal break-words " + escape(getTextColor(log), true)}"><!-- HTML_TAG_START -->${log}<!-- HTML_TAG_END --> </p>`;
  })}</div></div> <div class="flex flex-col gap-4 w-1/2"><h1 class="text-2xl" data-svelte-h="svelte-18sh36r">Socket logs</h1> <div class="flex flex-col gap-2">${each(socket_logs, (log) => {
    return `<p${add_attribute("class", getTextColor(log), 0)}><!-- HTML_TAG_START -->${log}<!-- HTML_TAG_END --> </p>`;
  })}</div></div></div></div>`;
});
export {
  Page as default
};
