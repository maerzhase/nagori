import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react";
import "./preview.css";

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    // Report axe violations — including colour contrast — as errors rather than
    // warnings, so a component cannot ship unreadable.
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      disable: true,
    },
    layout: "centered",
  },
};

export default preview;
