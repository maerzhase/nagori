import type { Meta, StoryObj } from "@storybook/react";
import { SlidePreview } from "../components/slide-preview";
import { Tab, TabPanel, Tabs, TabsList } from "../components/tabs";

const meta: Meta = {
  title: "Patterns/Navigation",
  parameters: {
    layout: "padded",
  },
};

export default meta;

export const SidebarTabs: StoryObj = {
  render: () => (
    <Tabs defaultValue="today" orientation="vertical" className="flex gap-6">
      <TabsList className="w-56 rounded-xl bg-sidebar p-2">
        <Tab value="today">Today</Tab>
        <Tab value="library">Library</Tab>
        <Tab value="family">Family</Tab>
        <Tab value="frame">Frame</Tab>
        <Tab value="settings">Settings</Tab>
      </TabsList>
      <TabPanel value="today">Today’s panel</TabPanel>
      <TabPanel value="library">Library panel</TabPanel>
      <TabPanel value="family">Family panel</TabPanel>
      <TabPanel value="frame">Frame panel</TabPanel>
      <TabPanel value="settings">Settings panel</TabPanel>
    </Tabs>
  ),
};

export const SlidePreviews: StoryObj = {
  render: () => (
    <div className="grid w-full max-w-3xl grid-cols-3 gap-4">
      <SlidePreview theme="paper" message="Happy birthday, Oma!" />
      <SlidePreview
        theme="sunset"
        message="Thinking of you both today."
        caption="From Markus"
      />
      <SlidePreview theme="garden" message="See you on Sunday." />
    </div>
  ),
};
