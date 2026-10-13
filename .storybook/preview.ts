import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "lyra-base",
      values: [
        { name: "lyra-base", value: "#ffffff" },
        { name: "lyra-shell", value: "#f3f5f6" },
        { name: "dark", value: "#1a2733" },
      ],
    },
  },
};

export default preview;
