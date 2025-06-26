import { c as create_ssr_component, a as add_attribute } from "./ssr.js";
const Seperator = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { height = "20" } = $$props;
  let { direction = "horizontal" } = $$props;
  if ($$props.height === void 0 && $$bindings.height && height !== void 0)
    $$bindings.height(height);
  if ($$props.direction === void 0 && $$bindings.direction && direction !== void 0)
    $$bindings.direction(direction);
  return `<div class="w-[1px] bg-secondary shrink-0"${add_attribute(
    "style",
    direction === "horizontal" ? `height: ${height}px;` : `width: 90%; height: 1px;`,
    0
  )}></div>`;
});
export {
  Seperator as S
};
